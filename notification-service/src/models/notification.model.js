const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'friend_request_sent',
      'friend_request_accepted',
      'plan_proposed',
      'plan_accepted',
      'plan_rejected',
      'plan_completed',
      'plan_date_changed',
      'review_liked',
      'review_upvoted',
      'review_commented',
    ],
  },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);