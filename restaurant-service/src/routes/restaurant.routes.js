const express = require('express');
const { healthCheck, getRestaurants, getRestaurantById, getCategories } = require('../controllers/restaurant.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/categories', getCategories);
router.get('/', getRestaurants);
router.get('/:id', getRestaurantById);

module.exports = router;
