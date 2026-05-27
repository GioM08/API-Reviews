const service = require("../services/auth.service");
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require("../utils/validators");

const healthCheck = (req, res) => {
  res.json({ status: "ok" });
};

const register = async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await service.register(data);
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const login = async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await service.login(data);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const data = verifyEmailSchema.parse(req.body);
    const result = await service.verifyEmail(data);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const data = resendVerificationCodeSchema.parse(req.body);
    const result = await service.resendVerificationCode(data);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const result = await service.forgotPassword(data);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const result = await service.resetPassword(data);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const registerAdmin = async (req, res) => {
  try {
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const data = registerSchema.parse(req.body);
    const user = await service.register(data, "admin");
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const banUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await service.banUser(req.params.id, reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const unbanUser = async (req, res) => {
  try {
    const result = await service.unbanUser(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  register,
  login,
  healthCheck,
  registerAdmin,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  banUser,
  unbanUser,
};