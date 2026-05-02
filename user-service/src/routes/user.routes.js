const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Ruta interna (service-to-service, sin auth)
/**
 * @openapi
 * /api/users/internal/batch:
 *   post:
 *     summary: Obtiene un lote de usuarios (Uso interno service-to-service)
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60d5ecb8b392d7...1", "60d5ecb8b392d7...2"]
 *     responses:
 *       200:
 *         description: Lote de usuarios obtenido correctamente
 */
router.post("/internal/batch", userController.getUsersBatch);

// Perfil público (sin auth — solo datos públicos)
/**
 * @openapi
 * /api/users/{id}/profile:
 *   get:
 *     summary: Obtiene el perfil público de un usuario
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a consultar
 *     responses:
 *       200:
 *         description: Perfil público del usuario obtenido
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/:id/profile", userController.getPublicProfile);

// Rutas protegidas
/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Obtiene el perfil detallado del usuario autenticado
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario obtenido correctamente
 *       401:
 *         description: No autorizado
 */
router.get("/me", authMiddleware, userController.getMyProfile);

/**
 * @openapi
 * /api/users/me:
 *   put:
 *     summary: Actualiza el perfil del usuario autenticado
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Pablo Silva"
 *               bio:
 *                 type: string
 *                 example: "Desarrollador de software y aficionado al fútbol."
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *       401:
 *         description: No autorizado
 */
router.put("/me", authMiddleware, userController.updateMyProfile);

module.exports = router;