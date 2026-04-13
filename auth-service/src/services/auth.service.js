const Auth = require("../models/auth.model.js");
const bcrypt = require("bcrypt");
const { signToken } = require("../utils/jwt.util.js");
const { publishUserCreated } = require("../utils/broker.util.js");

const register = async ({ email, password }) => {
  const exists = await Auth.findOne({ email });
  if (exists) throw new Error("Usuario ya existe");

  const hashed = await bcrypt.hash(password, 10);

  const user = await Auth.create({
    email,
    password: hashed,
  });

  await publishUserCreated({
    authId: user._id,
    email: user.email,
    role: user.role
  });

  return {
    id: user._id,
    email: user.email,
    role: user.role
  };
};

const login = async ({ email, password }) => {
  const user = await Auth.findOne({ email });
  if (!user) throw new Error("Usuario no encontrado");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Credenciales inválidas");

  const token = signToken({
    id: user._id,
    role: user.role
  });

  return { token };
};

module.exports = {
  register,
  login
};