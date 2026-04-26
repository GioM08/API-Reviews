const mongoose = require('mongoose');

const FriendshipSchema = new mongoose.Schema({
  requesterId: { type: String, required: true },
  recipientId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

FriendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', FriendshipSchema);
