const userService = require("../services/user.service");
const User = require("../models/user.model");

const getMyProfile = async (req, res) => {
  try {
    
    const user = await User.findOne({ authId: req.user.id });
    if (!user) return res.status(404).json({ error: "Perfil no encontrado" });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const updatedUser = await userService.updateProfile(req.user.id, req.body);
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile
};