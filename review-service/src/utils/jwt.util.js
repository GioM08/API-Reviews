const jwt = require('jsonwebtoken');
const fs = require('fs');

const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY);

const verifyToken = (token) => {
  return jwt.verify(token, publicKey);
};

module.exports = { verifyToken };
