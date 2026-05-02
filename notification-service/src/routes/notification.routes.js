const express = require('express');
const router = express.Router();
const controller = require('../controllers/notification.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Obtener todas las notificaciones
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 */
router.get('/', controller.getMyNotifications);

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     summary: Obtener cantidad de notificaciones sin leer
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo de notificaciones
 */
router.get('/unread-count', controller.getUnreadCount);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     summary: Marcar todas las notificaciones como leídas
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notificaciones actualizadas correctamente
 */
router.patch('/read-all', controller.markAllAsRead);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Marcar una notificación específica como leída
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notificación
 *     responses:
 *       200:
 *         description: Notificación actualizada correctamente
 */
router.patch('/:id/read', controller.markAsRead);

/**
 * @openapi
 * /api/notifications/token:
 *   post:
 *     summary: Registrar un token de dispositivo FCM
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 example: "cQk...fD_8"
 *     responses:
 *       200:
 *         description: Token registrado
 */
router.post('/token', controller.registerToken);

/**
 * @openapi
 * /api/notifications/token:
 *   delete:
 *     summary: Eliminar un token de dispositivo FCM
 *     tags:
 *       - Servicio de notificaciones
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 example: "cQk...fD_8"
 *     responses:
 *       200:
 *         description: Token eliminado
 */
router.delete('/token', controller.removeToken);

module.exports = router;