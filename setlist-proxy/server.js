const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const User = require('./models/User');
const Moment = require('./models/Moment');

const app = express();
const PORT = 5050;

// Middleware setup
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

const { estimateAndUpload } = require('./utils/bundlrUploader');
// const uploadFileToIrys = require('./utils/irysUploader'); // Optional fallback

// JWT token helpers
const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Setlist.fm proxy
app.use(
  '/api',
  createProxyMiddleware({
    target: 'https://api.setlist.fm',
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    headers: {
      Accept: 'application/json',
      'x-api-key': process.env.SETLIST_FM_API_KEY,
      'User-Agent': 'SetlistProxy/1.0',
    },
    logLevel: 'debug',
  })
);

// Auth: Register
app.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, displayName });
      await user.setPassword(password);
      await user.save();
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Auth: Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await user.validatePassword(password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Upload file via Bundlr to Arweave
app.post('/upload-file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const uri = await estimateAndUpload(req.file.buffer, req.file.originalname);
    res.json({ success: true, fileUri: uri });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Upload moment (record metadata + media URI)
app.post('/upload-moment', authenticateToken, async (req, res) => {
  const { performanceId, songName, mediaUrl, fileUri } = req.body;
  const userId = req.user.id;

  if (!performanceId || !songName || (!mediaUrl && !fileUri)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const moment = new Moment({
      user: userId,
      performanceId,
      songName,
      mediaUrl: fileUri || mediaUrl,
    });

    await moment.save();
    res.json({ success: true, moment });
  } catch (err) {
    console.error('❌ Upload moment error:', err);
    res.status(500).json({ error: 'Moment upload failed' });
  }
});

// Get user moments
app.get('/moments', authenticateToken, async (req, res) => {
  try {
    const moments = await Moment.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('user', 'email displayName');

    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch moments error:', err);
    res.status(500).json({ error: 'Failed to fetch moments' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
