const service = require("../services/auth.service");
const { registerSchema, loginSchema } = require("../utils/validators");

const healthCheck = (req, res) => {
  res.json({ status: "ok" });
}

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

const registerAdmin = async (req, res) => {
  try {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const data = registerSchema.parse(req.body);
    const user = await service.register(data, 'admin');
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  register,
  login,
  healthCheck,
  registerAdmin
};