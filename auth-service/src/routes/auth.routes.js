const express = require("express");
const { register, login, healthCheck, registerAdmin } = require("../controllers/auth.controller");

const router = express.Router();

router.get("/health", healthCheck);
router.post("/register", register);
router.post("/register/admin", registerAdmin);
router.post("/login", login);

module.exports = router;