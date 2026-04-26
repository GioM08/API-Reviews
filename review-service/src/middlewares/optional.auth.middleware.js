const { verifyToken } = require('../utils/jwt.util');

const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      req.user = verifyToken(token);
    }
  } catch {
    // token inválido → simplemente no se autentica
  }
  next();
};

module.exports = optionalAuth;
