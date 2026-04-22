const { pool } = require('../config/db');
const { fetchNearbyPlaces, fetchPlaceDetails, fetchPhotoUrl } = require('../utils/google-places.util');
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

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM restaurants
     WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
    [latMin, latMax, lngMin, lngMax]
  );

  if (parseInt(countResult.rows[0].count) < 10) {
    console.log(' [.] Pocos resultados en zona, consultando Google Places...');
    const places = await fetchNearbyPlaces(lat, lng, radius);

    for (const place of places) {
      const result = await pool.query(
        `INSERT INTO restaurants
           (name, description, address, category, latitude, longitude,
            place_id, photo_reference, price_level, google_rating)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (place_id) DO NOTHING
         RETURNING *`,
        [
          place.name, place.description, place.address, place.category,
          place.latitude, place.longitude, place.place_id,
          place.photo_reference, place.price_level, place.google_rating,
        ]
      );
      if (result.rows[0]) {
        await publishRestaurantCreated(result.rows[0]);
      }
    }
    console.log(` [v] ${places.length} lugares importados desde Google Places`);
  }

  const params = [latMin, latMax, lngMin, lngMax];
  let query = `SELECT * FROM restaurants
               WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`;

  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  query += ' ORDER BY score DESC, google_rating DESC NULLS LAST LIMIT 30';
  const result = await pool.query(query, params);
  return result.rows;
};

const getRestaurants = async () => {
  const result = await pool.query(
    'SELECT * FROM restaurants ORDER BY score DESC, google_rating DESC NULLS LAST'
  );
  return result.rows;
};

// Incluye lazy-fetch de detalles desde Google Places (teléfono, web, horarios).
// Costo: $0.017 por lugar, solo la primera vez (luego details_fetched = true).
const getRestaurantById = async (id) => {
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!result.rows[0]) return null;

  const restaurant = result.rows[0];

  if (!restaurant.details_fetched && restaurant.place_id) {
    try {
      const details = await fetchPlaceDetails(restaurant.place_id);
      await pool.query(
        `UPDATE restaurants
         SET address         = COALESCE(NULLIF($1, ''), address),
             phone_number    = $2,
             website         = $3,
             opening_hours   = $4::jsonb,
             price_level     = COALESCE($5, price_level),
             google_rating   = COALESCE($6, google_rating),
             details_fetched = TRUE
         WHERE id = $7`,
        [
          details.address,
          details.phone_number,
          details.website,
          details.opening_hours ? JSON.stringify(details.opening_hours) : null,
          details.price_level,
          details.google_rating,
          restaurant.id,
        ]
      );
      Object.assign(restaurant, details, { details_fetched: true });
    } catch (err) {
      console.error(' [!] Error al obtener detalles de Google Places:', err.message);
    }
  }

  return restaurant;
};

// Devuelve la URL de la foto del lugar. Costo: $0.007 por foto, solo la primera vez (luego se cachea en photo_url).
const getRestaurantPhotoUrl = async (id) => {
  const result = await pool.query(
    'SELECT photo_reference, photo_url FROM restaurants WHERE id = $1',
    [id]
  );
  if (!result.rows[0]) return null;

  const { photo_reference, photo_url } = result.rows[0];

  if (photo_url) return photo_url;
  if (!photo_reference) return null;

  const finalUrl = await fetchPhotoUrl(photo_reference);
  await pool.query('UPDATE restaurants SET photo_url = $1 WHERE id = $2', [finalUrl, id]);
  return finalUrl;
};

const updateScore = async (restaurantId, newStars) => {
  await pool.query(
    `UPDATE restaurants
     SET score        = (score * review_count + $1::DECIMAL) / (review_count + 1),
         review_count = review_count + 1
     WHERE id = $2`,
    [newStars, restaurantId]
  );
};

module.exports = {
  getNearbyRestaurants,
  getRestaurants,
  getRestaurantById,
  getRestaurantPhotoUrl,
  updateScore,
};
