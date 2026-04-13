const jwt = require("jsonwebtoken");
const fs = require("fs");

const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY);
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY);

const signToken = (payload) => {
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h"
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, publicKey);
};

module.exports = {
  signToken,
  verifyToken
};