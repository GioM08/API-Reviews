const { pool } = require('../config/db');
const { fetchNearbyPlaces } = require('../utils/overpass.util');
const { publishRestaurantCreated } = require('../utils/broker.util');

const getBoundingBox = (lat, lng, radius) => {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
};

const getNearbyRestaurants = async (lat, lng, radius = 2000, category = null) => {
  const { latMin, latMax, lngMin, lngMax } = getBoundingBox(lat, lng, radius);

  // Verificar si hay suficientes registros en la zona (sin filtro de categoría)
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM restaurants
     WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
    [latMin, latMax, lngMin, lngMax]
  );

  if (parseInt(countResult.rows[0].count) < 10) {
    console.log(' [.] Pocos resultados en zona, consultando Overpass...');
    const places = await fetchNearbyPlaces(lat, lng, radius);

    for (const place of places) {
      const result = await pool.query(
        `INSERT INTO restaurants (name, description, address, category, latitude, longitude, osm_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (osm_id) DO NOTHING
         RETURNING *`,
        [place.name, place.description, place.address, place.category, place.latitude, place.longitude, place.osm_id]
      );
      if (result.rows[0]) {
        await publishRestaurantCreated(result.rows[0]);
      }
    }
    console.log(` [v] ${places.length} lugares importados desde Overpass`);
  }

  const params = [latMin, latMax, lngMin, lngMax];
  let query = `SELECT * FROM restaurants
               WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`;

  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  query += ' ORDER BY score DESC LIMIT 30';
  const result = await pool.query(query, params);
  return result.rows;
};

const getRestaurants = async () => {
  const result = await pool.query('SELECT * FROM restaurants ORDER BY score DESC');
  return result.rows;
};

const getRestaurantById = async (id) => {
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const updateScore = async (restaurantId, newStars) => {
  await pool.query(
    `UPDATE restaurants
     SET score = (score * review_count + $1::DECIMAL) / (review_count + 1),
         review_count = review_count + 1
     WHERE id = $2`,
    [newStars, restaurantId]
  );
};

module.exports = { getNearbyRestaurants, getRestaurants, getRestaurantById, updateScore };
