const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performanceId: { type: String, required: true },
  songName: { type: String, required: true },
  mediaUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Moment', momentSchema);
