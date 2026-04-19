const User = require("../models/user.model");

const createInitialProfile = async (userData) => {
  try {

    const exists = await User.findOne({ authId: userData.authId });
    if (exists) return exists;

    const newUser = await User.create({
      authId: userData.authId,
      email: userData.email,

    });

    return newUser;
  } catch (error) {
    console.error("Error en userService.createInitialProfile:", error);
    throw error;
  }
};

const updateProfile = async (authId, updateData) => {

  const { name, bio, avatar } = updateData;
  return await User.findOneAndUpdate(
    { authId },
    { name, bio, avatar },
    { new: true }
  );
};

module.exports = {
  createInitialProfile,
  updateProfile
};