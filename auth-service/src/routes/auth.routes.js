const express = require("express");
const { register, login, healthCheck, registerAdmin } = require("../controllers/auth.controller");

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
 *         description: Incio de sesión correctamente
 *       400:
 *         description: Credenciales incorrectas 
 */
router.post("/login", login);

module.exports = router;