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

const getUsersBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({});

    const users = await User.find({ authId: { $in: ids } }, 'authId name avatar');
    const map = {};
    for (const u of users) map[u.authId] = { name: u.name, avatar: u.avatar };
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findOne(
      { authId: req.params.id },
      'authId name avatar bio createdAt'
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getUsersBatch,
  getPublicProfile,
};