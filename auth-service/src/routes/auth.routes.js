const express = require("express");
const {
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
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

const router = express.Router();

router.get("/health", healthCheck);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Registro de un nuevo usuario no ADMIN
 *     tags:
 *       - Servicio de auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "pablocorreobonito14@gmail.com"
 *               password:
 *                 type: string
 *                 example: "123456!"
 *     responses:
 *       201:
 *         description: Happy path
 *       400:
 *         description: Error
 */
router.post("/register", register);

/**
 * @openapi
 * /api/auth/register/admin:
 *   post:
 *     summary: Registro de un nuevo ADMIN
 *     tags:
 *       - Servicio de auth
 *     security: 
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "adminbonito14@gmail.com"
 *               password:
 *                 type: string
 *                 example: "123456aA!"
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente
 *       400:
 *         description: Datos invalidos
 *       403: 
 *         description: Acceso denegado
 */
router.post("/register/admin", registerAdmin);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login de un usuario ya registrado
 *     tags:
 *       - Servicio de auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "pablocorreobonito14@gmail.com"
 *               password:
 *                 type: string
 *                 example: "123456!"
 *     responses:
 *       200:
 *         description: Inicio de sesión correctamente
 *       400:
 *         description: Credenciales incorrectas 
 */
router.post("/login", login);

router.post("/verify-email", verifyEmail);

router.post("/resend-verification-code", resendVerificationCode);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicita un código para restablecer contraseña
 *     tags:
 *       - Servicio de auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "usuario@gmail.com"
 *     responses:
 *       200:
 *         description: Código enviado si el correo existe
 *       400:
 *         description: Error al solicitar código
 */
router.post("/forgot-password", forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablece la contraseña usando código enviado por correo
 *     tags:
 *       - Servicio de auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 example: "usuario@gmail.com"
 *               code:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: "Nueva123!"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Código inválido, expirado o datos incorrectos
 */
router.post("/reset-password", resetPassword);

// Admin — gestión de usuarios
router.patch("/users/:id/ban", authMiddleware, adminMiddleware, banUser);
router.patch("/users/:id/unban", authMiddleware, adminMiddleware, unbanUser);

module.exports = router;