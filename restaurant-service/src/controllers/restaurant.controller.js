const service = require('../services/restaurant.service');
const { CATEGORY_MAP } = require('../utils/overpass.util');

const healthCheck = (req, res) => {
  res.json({ status: 'ok' });
};

const getRestaurants = async (req, res) => {
  try {
    const { lat, lng, radius, category } = req.query;

    if (lat && lng) {
      const places = await service.getNearbyRestaurants(
        parseFloat(lat),
        parseFloat(lng),
        radius ? parseInt(radius) : 2000,
        category || null
      );
      return res.json(places);
    }

    const restaurants = await service.getRestaurants();
    res.json(restaurants);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await service.getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(restaurant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getCategories = (req, res) => {
  res.json(Object.values(CATEGORY_MAP));
};

module.exports = { healthCheck, getRestaurants, getRestaurantById, getCategories };
