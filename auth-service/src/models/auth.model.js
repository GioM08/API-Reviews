const mongoose = require("mongoose");

const authSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: "user"
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationCodeHash: {
    type: String,
    default: null,
    select: false
  },
  verificationCodeExpiresAt: {
    type: Date,
    default: null
  },
  verificationCodeSentAt: {
    type: Date,
    default: null
  },

  passwordResetCodeHash: {
    type: String,
    default: null,
    select: false
  },
  passwordResetCodeExpiresAt: {
    type: Date,
    default: null
  },
  passwordResetCodeSentAt: {
    type: Date,
    default: null
  },

  userCreatedPublished: {
    type: Boolean,
    default: false
  },

  banned: {
    type: Boolean,
    default: false
  },
  bannedAt: {
    type: Date,
    default: null
  },
  banReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("User", authSchema);