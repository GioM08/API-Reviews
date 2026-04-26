const mongoose = require('mongoose');

const DeviceTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
}, { timestamps: true });

module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);
