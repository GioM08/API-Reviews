const express = require("express");
const { register, login, healthCheck } = require("../controllers/auth.controller");

const router = express.Router();

router.get("/health", healthCheck);
router.post("/register", register);
router.post("/login", login);

module.exports = router;