const express = require('express');
const router = express.Router();
const controller = require('../controllers/plan.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

/**
 * @openapi
 * /api/plans:
 *   get:
 *     summary: Obtiene todos los planes del usuario autenticado
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de planes
 */
router.get('/', controller.getMyPlans);

/**
 * @openapi
 * /api/plans:
 *   post:
 *     summary: Crea un nuevo plan
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId, participantIds, proposedDate]
 *             properties:
 *               restaurantId:
 *                 type: integer
 *               restaurantName:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               proposedDate:
 *                 type: string
 *                 format: date-time
 *               context:
 *                 type: object
 *                 properties:
 *                   moment:
 *                     type: string
 *                     enum: [breakfast, lunch, dinner]
 *     responses:
 *       201:
 *         description: Plan creado
 */
router.post('/', controller.createPlan);

/**
 * @openapi
 * /api/plans/{id}:
 *   get:
 *     summary: Obtiene los detalles de un plan (devuelve ETag en header)
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalles del plan
 *         headers:
 *           ETag:
 *             schema:
 *               type: string
 *             description: Versión del plan para control de concurrencia
 */
router.get('/:id', controller.getPlanById);

/**
 * @openapi
 * /api/plans/{id}/accept:
 *   post:
 *     summary: Acepta una invitación a un plan
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: If-Match
 *         schema:
 *           type: string
 *         description: ETag obtenido al consultar el plan
 *     responses:
 *       200:
 *         description: Plan aceptado
 *       412:
 *         description: El plan fue modificado por otra acción (conflicto de versión)
 */
router.post('/:id/accept', controller.acceptPlan);

/**
 * @openapi
 * /api/plans/{id}/reject:
 *   post:
 *     summary: Rechaza una invitación a un plan
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: If-Match
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan rechazado
 *       412:
 *         description: Conflicto de versión
 */
router.post('/:id/reject', controller.rejectPlan);

/**
 * @openapi
 * /api/plans/{id}/complete:
 *   patch:
 *     summary: Marca un plan como completado (solo proponente)
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: If-Match
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan completado
 *       412:
 *         description: Conflicto de versión
 */
router.patch('/:id/complete', controller.completePlan);

/**
 * @openapi
 * /api/plans/{id}/date:
 *   patch:
 *     summary: Cambia la fecha del plan (solo proponente, requiere If-Match)
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: If-Match
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [proposedDate]
 *             properties:
 *               proposedDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Fecha actualizada
 *       412:
 *         description: Conflicto de versión
 */
router.patch('/:id/date', controller.updatePlanDate);

/**
 * @openapi
 * /api/plans/{id}/invite:
 *   post:
 *     summary: Invita nuevos participantes al plan (solo proponente)
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantIds]
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participantes añadidos
 *       400:
 *         description: Error de validación o el usuario no es amigo
 */
router.post('/:id/invite', controller.inviteParticipants);

/**
 * @openapi
 * /api/plans/{id}/participants/{userId}:
 *   delete:
 *     summary: Elimina un participante del plan (solo proponente, requiere If-Match)
 *     tags: [Planes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: If-Match
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participante eliminado
 *       412:
 *         description: Conflicto de versión
 */
router.delete('/:id/participants/:userId', controller.removeParticipant);

module.exports = router;