const express = require('express');
const router = express.Router();
const controller = require('../controllers/friendship.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

/**
 * @openapi
 * /api/friends:
 *   get:
 *     summary: Obtiene la lista de amigos del usuario autenticado
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de amigos
 */
router.get('/', controller.getMyFriends);

/**
 * @openapi
 * /api/friends/requests:
 *   get:
 *     summary: Obtiene la lista de solicitudes de amistad pendientes
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitudes pendientes
 */
router.get('/requests', controller.getPendingRequests);

/**
 * @openapi
 * /api/friends/status/{otherId}:
 *   get:
 *     summary: Verifica el estado de amistad con otro usuario
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: otherId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del otro usuario
 *     responses:
 *       200:
 *         description: Estado de la amistad obtenido correctamente
 */
router.get('/status/:otherId', controller.getFriendshipStatus);

/**
 * @openapi
 * /api/friends/request/{targetId}:
 *   post:
 *     summary: Envía una solicitud de amistad a otro usuario
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario al que se envía la solicitud
 *     responses:
 *       201:
 *         description: Solicitud de amistad enviada
 */
router.post('/request/:targetId', controller.sendRequest);

/**
 * @openapi
 * /api/friends/accept/{requesterId}:
 *   post:
 *     summary: Acepta una solicitud de amistad
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario que envió la solicitud
 *     responses:
 *       200:
 *         description: Solicitud de amistad aceptada
 */
router.post('/accept/:requesterId', controller.acceptRequest);

/**
 * @openapi
 * /api/friends/reject/{requesterId}:
 *   post:
 *     summary: Rechaza una solicitud de amistad
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario que envió la solicitud
 *     responses:
 *       200:
 *         description: Solicitud de amistad rechazada
 */
router.post('/reject/:requesterId', controller.rejectRequest);

/**
 * @openapi
 * /api/friends/{friendId}:
 *   delete:
 *     summary: Elimina a un amigo de la lista de amistades
 *     tags:
 *       - Amistades
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del amigo a eliminar
 *     responses:
 *       200:
 *         description: Amigo eliminado correctamente
 */
router.delete('/:friendId', controller.removeFriend);

module.exports = router;