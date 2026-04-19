const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden realizar esta acción' });
  }
  next();
};

module.exports = adminMiddleware;
