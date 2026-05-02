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
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de planes obtenida correctamente
 */
router.get('/', controller.getMyPlans);

/**
 * @openapi
 * /api/plans:
 *   post:
 *     summary: Crea un nuevo plan
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: "Cena de cumpleaños"
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-15T20:00:00Z"
 *     responses:
 *       201:
 *         description: Plan creado correctamente
 */
router.post('/', controller.createPlan);

/**
 * @openapi
 * /api/plans/{id}:
 *   get:
 *     summary: Obtiene los detalles de un plan específico
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del plan
 *     responses:
 *       200:
 *         description: Detalles del plan
 */
router.get('/:id', controller.getPlanById);

/**
 * @openapi
 * /api/plans/{id}/accept:
 *   post:
 *     summary: Acepta una invitación a un plan
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del plan
 *     responses:
 *       200:
 *         description: Plan aceptado
 */
router.post('/:id/accept', controller.acceptPlan);

/**
 * @openapi
 * /api/plans/{id}/reject:
 *   post:
 *     summary: Rechaza una invitación a un plan
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del plan
 *     responses:
 *       200:
 *         description: Plan rechazado
 */
router.post('/:id/reject', controller.rejectPlan);

/**
 * @openapi
 * /api/plans/{id}/complete:
 *   patch:
 *     summary: Marca un plan como completado
 *     tags:
 *       - Planes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del plan
 *     responses:
 *       200:
 *         description: Plan marcado como completado
 */
router.patch('/:id/complete', controller.completePlan);

module.exports = router;