const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    authId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    name: { type: String, default: "" },
    avatar: { type: String, default: "default-avatar.png" },
    bio: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);