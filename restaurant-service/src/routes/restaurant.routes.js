const express = require('express');
const {
  healthCheck,
  getRestaurants,
  getRestaurantById,
  getRestaurantPhoto,
  getCategories,
} = require('../controllers/restaurant.controller');

const router = express.Router();

/**
 * @openapi
 * /api/restaurants/health:
 *   get:
 *     summary: Verifica el estado del servicio de restaurantes
 *     tags:
 *       - Servicio de restaurantes
 *     responses:
 *       200:
 *         description: El servicio está en funcionamiento
 */
router.get('/health', healthCheck);

/**
 * @openapi
 * /api/restaurants/categories:
 *   get:
 *     summary: Obtiene la lista de todas las categorías de comida
 *     tags:
 *       - Servicio de restaurantes
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida correctamente
 */
router.get('/categories', getCategories);

/**
 * @openapi
 * /api/restaurants:
 *   get:
 *     summary: Obtiene el catálogo completo de restaurantes
 *     tags:
 *       - Servicio de restaurantes
 *     responses:
 *       200:
 *         description: Lista de restaurantes obtenida correctamente
 */
router.get('/', getRestaurants);

/**
 * @openapi
 * /api/restaurants/{id}/photo:
 *   get:
 *     summary: Obtiene la fotografía de un restaurante específico
 *     tags:
 *       - Servicio de restaurantes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Archivo de imagen del restaurante
 *       404:
 *         description: Restaurante o foto no encontrada
 */
router.get('/:id/photo', getRestaurantPhoto);

/**
 * @openapi
 * /api/restaurants/{id}:
 *   get:
 *     summary: Obtiene los detalles completos de un restaurante por su ID
 *     tags:
 *       - Servicio de restaurantes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Detalles del restaurante obtenidos correctamente
 *       404:
 *         description: Restaurante no encontrado
 */
router.get('/:id', getRestaurantById);

module.exports = router;