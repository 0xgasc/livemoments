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

// Enhanced CORS setup for file uploads
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));

app.use(express.json({ limit: '6gb' })); // Increase JSON limit to 6GB
app.use(express.urlencoded({ limit: '6gb', extended: true })); // Add URL encoded limit

// Enhanced multer configuration for large files (up to 6GB for Zora compatibility)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 6 * 1024 * 1024 * 1024, // 6GB limit to match Zora
    fieldSize: 6 * 1024 * 1024 * 1024, // 6GB field size
    fields: 10,
    files: 1,
    parts: 1000
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 Multer received file:`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'size not available yet'
    });
    
    // Check file size early if possible
    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (file.size && file.size > maxSize) {
      console.error(`❌ File too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB exceeds 6GB limit`);
      return cb(new Error('File exceeds 6GB limit'), false);
    }
    
    // Accept all file types but log them
    cb(null, true);
  }
});

// Import your uploaders
const { hybridUpload } = require('./utils/bundlrUploader');
const { uploadFileToIrys, validateBuffer } = require('./utils/irysUploader');

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

// Enhanced file upload endpoint with better debugging and large file handling
app.post('/upload-file', authenticateToken, (req, res, next) => {
  // Add timeout for large file uploads (30 minutes)
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes
  next();
}, upload.single('file'), async (req, res) => {
  try {
    console.log(`🔍 Upload request received:`, {
      hasFile: !!req.file,
      headers: req.headers,
      bodyKeys: Object.keys(req.body)
    });

    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSizeGB = (req.file.size / 1024 / 1024 / 1024).toFixed(2);
    console.log(`📁 File details:`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      sizeGB: `${fileSizeGB}GB`,
      bufferLength: req.file.buffer?.length,
      bufferType: typeof req.file.buffer,
      isBuffer: Buffer.isBuffer(req.file.buffer)
    });

    // Check if file is too large for memory
    if (req.file.size > 6 * 1024 * 1024 * 1024) {
      console.error(`❌ File too large: ${fileSizeGB}GB exceeds 6GB limit`);
      return res.status(413).json({ 
        error: 'File too large', 
        details: `File size ${fileSizeGB}GB exceeds 6GB limit` 
      });
    }

    // Validate the buffer before upload
    if (!validateBuffer(req.file.buffer, req.file.originalname)) {
      console.error('❌ Buffer validation failed');
      return res.status(400).json({ error: 'Invalid file buffer' });
    }

    console.log(`🚀 Starting upload process for ${fileSizeGB}GB file...`);
    
    // Use hybrid upload strategy that handles both small and large files efficiently
    let uri;
    try {
      console.log('📤 Using hybrid upload strategy...');
      uri = await hybridUpload(req.file.buffer, req.file.originalname);
      console.log('✅ Hybrid upload successful:', uri);
    } catch (uploadError) {
      console.error('❌ Hybrid upload failed:', uploadError);
      
      // Fallback to Irys for smaller files only
      if (req.file.size < 500 * 1024 * 1024) { // Less than 500MB
        console.log('📤 Falling back to Irys upload for smaller file...');
        try {
          const result = await uploadFileToIrys(req.file.buffer, req.file.originalname);
          uri = result.url;
          console.log('✅ Irys fallback upload successful:', uri);
        } catch (irysError) {
          console.error('❌ Irys fallback also failed:', irysError);
          throw uploadError; // Throw original error
        }
      } else {
        throw uploadError;
      }
    }

    console.log(`✅ Upload completed successfully: ${uri}`);
    res.json({ 
      success: true, 
      fileUri: uri,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        sizeGB: fileSizeGB,
        mimetype: req.file.mimetype
      }
    });

  } catch (err) {
    console.error('❌ Upload error:', err);
    console.error('Error stack:', err.stack);
    
    // Provide more specific error messages
    let errorMessage = 'File upload failed';
    let statusCode = 500;
    
    if (err.message.includes('File too large') || err.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'File exceeds size limit';
      statusCode = 413;
    } else if (err.message.includes('timeout')) {
      errorMessage = 'Upload timed out - file may be too large';
      statusCode = 408;
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('network')) {
      errorMessage = 'Network error - check internet connection';
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: err.message 
    });
  }
});

// Test endpoint to check uploaded file
app.get('/test-file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const url = `https://gateway.irys.xyz/${fileId}`;
    
    console.log(`🔍 Testing file: ${url}`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log(`📊 File info:`, {
      contentType,
      contentLength,
      status: response.status
    });
    
    res.json({
      success: true,
      fileId,
      url,
      contentType,
      contentLength,
      headers: Object.fromEntries(response.headers.entries())
    });
    
  } catch (err) {
    console.error('❌ Test file error:', err);
    res.status(500).json({ error: 'Failed to test file' });
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large', 
        details: 'File exceeds 6GB limit',
        maxSize: '6GB'
      });
    } else if (error.code === 'LIMIT_FIELD_SIZE') {
      return res.status(413).json({ 
        error: 'Field too large', 
        details: 'Upload field exceeds size limit' 
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected file field', 
        details: 'Only single file uploads are supported' 
      });
    }
    
    return res.status(400).json({ 
      error: 'Upload error', 
      details: error.message 
    });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});