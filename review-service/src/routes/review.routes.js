const express = require('express');
const {
  healthCheck, createReview, getReviews, getRestaurantStats, getSegmentedScores,
  voteReview, reportReview, getReportedReviews, hideReview, deleteReview,
  toggleLike, getComments, addComment, deleteComment,
} = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const optionalAuth = require('../middlewares/optional.auth.middleware');

const router = express.Router();

/**
 * @openapi
 * /api/reviews/health:
 *   get:
 *     summary: Verifica el estado del servicio de reseñas
 *     tags:
 *       - Servicio de reseñas
 *     responses:
 *       200:
 *         description: El servicio está en funcionamiento
 */
router.get('/health', healthCheck);

/**
 * @openapi
 * /api/reviews/restaurant/{id}/stats:
 *   get:
 *     summary: Devuelve detailed_ratings_avg y amenities_stats de un restaurante
 *     tags:
 *       - Servicio de reseñas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Estadísticas calculadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 detailed_ratings_avg:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                 amenities_stats:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 */
router.get('/restaurant/:id/stats', getRestaurantStats);

// Scores segmentados por contexto
/**
 * @openapi
 * /api/reviews/restaurant/{id}/segmented:
 *   get:
 *     summary: Obtiene los puntajes segmentados por contexto de un restaurante
 *     tags:
 *       - Servicio de reseñas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Puntajes obtenidos correctamente
 */
router.get('/restaurant/:id/segmented', getSegmentedScores);

// Usuario
/**
 * @openapi
 * /api/reviews:
 *   get:
 *     summary: Obtiene la lista de reseñas (Autenticación opcional)
 *     tags:
 *       - Servicio de reseñas
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     responses:
 *       200:
 *         description: Lista de reseñas
 */
router.get('/', optionalAuth, getReviews);

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     summary: Crea una nueva reseña
 *     tags:
 *       - Servicio de reseñas
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
 *               rating:
 *                 type: integer
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Excelente servicio y comida"
 *     responses:
 *       201:
 *         description: Reseña creada correctamente
 */
router.post('/', authMiddleware, createReview);

/**
 * @openapi
 * /api/reviews/{id}/vote:
 *   post:
 *     summary: Vota una reseña (ej. útil o no útil)
 *     tags:
 *       - Servicio de reseñas
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
 *             properties:
 *               voteType:
 *                 type: string
 *                 example: "upvote"
 *     responses:
 *       200:
 *         description: Voto registrado
 */
router.post('/:id/vote', authMiddleware, voteReview);

/**
 * @openapi
 * /api/reviews/{id}/report:
 *   post:
 *     summary: Reporta una reseña por contenido inapropiado
 *     tags:
 *       - Servicio de reseñas
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
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Lenguaje ofensivo"
 *     responses:
 *       200:
 *         description: Reseña reportada exitosamente
 */
router.post('/:id/report', authMiddleware, reportReview);

// Likes (toggle: 1 like por perfil por reseña)
/**
 * @openapi
 * /api/reviews/{id}/like:
 *   post:
 *     summary: Alterna el 'Me gusta' de una reseña (1 por perfil)
 *     tags:
 *       - Servicio de reseñas
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
 *         description: Like actualizado
 */
router.post('/:id/like', authMiddleware, toggleLike);

// Comments (ilimitados por perfil)
/**
 * @openapi
 * /api/reviews/{id}/comments:
 *   get:
 *     summary: Obtiene los comentarios de una reseña
 *     tags:
 *       - Comentarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la reseña
 *     responses:
 *       200:
 *         description: Lista de comentarios
 */
router.get('/:id/comments', getComments);

/**
 * @openapi
 * /api/reviews/{id}/comments:
 *   post:
 *     summary: Agrega un comentario a una reseña
 *     tags:
 *       - Comentarios
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
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Totalmente de acuerdo con tu reseña!!!"
 *     responses:
 *       201:
 *         description: Comentario agregado
 */
router.post('/:id/comments', authMiddleware, addComment);

/**
 * @openapi
 * /api/reviews/{id}/comments/{commentId}:
 *   delete:
 *     summary: Elimina un comentario de una reseña
 *     tags:
 *       - Comentarios
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la reseña
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del comentario a eliminar
 *     responses:
 *       200:
 *         description: Comentario eliminado
 */
router.delete('/:id/comments/:commentId', authMiddleware, deleteComment);

// Admin
/**
 * @openapi
 * /api/reviews/reported:
 *   get:
 *     summary: Obtiene la lista de reseñas reportadas (Solo Admins)
 *     tags:
 *       - Administrador
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reseñas reportadas
 *       403:
 *         description: Acceso denegado (requiere permisos de Admin)
 */
router.get('/reported', authMiddleware, adminMiddleware, getReportedReviews);

/**
 * @openapi
 * /api/reviews/{id}/hide:
 *   patch:
 *     summary: Oculta una reseña específica (Solo Admins)
 *     tags:
 *       - Administrador
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
 *         description: Reseña ocultada correctamente
 *       403:
 *         description: Acceso denegado (requiere permisos de Admin)
 */
router.patch('/:id/hide', authMiddleware, adminMiddleware, hideReview);

/**
 * @openapi
 * /api/reviews/{id}:
 *   delete:
 *     summary: Elimina permanentemente una reseña (Solo Admins)
 *     tags:
 *       - Administrador
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
 *         description: Reseña eliminada correctamente
 *       403:
 *         description: Acceso denegado (requiere permisos de Admin)
 */
router.delete('/:id', authMiddleware, adminMiddleware, deleteReview);

module.exports = router;