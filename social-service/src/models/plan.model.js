const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
}, { _id: false });

const PlanSchema = new mongoose.Schema({
  restaurantId: { type: Number, required: true },
  restaurantName: { type: String, default: '' },
  proposerId: { type: String, required: true },
  participants: [ParticipantSchema],
  proposedDate: { type: Date, required: true },
  context: {
    moment: { type: String, enum: ['breakfast', 'lunch', 'dinner'], default: null },
    when: { type: String, enum: ['weekday', 'weekend'], default: null },
  },
  status: {
    type: String,
    enum: ['proposed', 'accepted', 'rejected', 'completed'],
    default: 'proposed',
  },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
