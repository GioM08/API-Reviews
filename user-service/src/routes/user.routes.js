const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Ruta interna (service-to-service, sin auth)
router.post("/internal/batch", userController.getUsersBatch);

// Perfil público (sin auth — solo datos públicos)
router.get("/:id/profile", userController.getPublicProfile);

// Rutas protegidas
router.get("/me", authMiddleware, userController.getMyProfile);
router.put("/me", authMiddleware, userController.updateMyProfile);

module.exports = router;