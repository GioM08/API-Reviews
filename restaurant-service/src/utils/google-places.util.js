const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const GOOGLE_TYPE_TO_CATEGORY = {
  restaurant: 'Restaurante',
  cafe: 'Café',
  bar: 'Bar',
  night_club: 'Bar',
  bakery: 'Panadería',
  meal_takeaway: 'Comida rápida',
  meal_delivery: 'Comida rápida',
  food_court: 'Patio de comidas',
  ice_cream_shop: 'Heladería',
};

const CATEGORY_MAP = {
  Restaurante: 'Restaurante',
  Café: 'Café',
  Bar: 'Bar',
  'Comida rápida': 'Comida rápida',
  Panadería: 'Panadería',
  'Patio de comidas': 'Patio de comidas',
  Heladería: 'Heladería',
  Pub: 'Pub',
};

const mapTypesToCategory = (types = []) => {
  for (const type of types) {
    if (GOOGLE_TYPE_TO_CATEGORY[type]) return GOOGLE_TYPE_TO_CATEGORY[type];
  }
  return 'Restaurante';
};

// Tipos de comida a consultar. Cada uno es un request separado ($0.032 c/u), pero solo ocurre una vez por zona.
const FOOD_TYPES = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'];

const fetchByType = async (apiKey, lat, lng, radius, type) => {
  const results = [];
  let pageToken = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: String(radius),
      type,
      language: 'es',
      key: apiKey,
    });
    if (pageToken) {
      params.set('pagetoken', pageToken);
      await new Promise(r => setTimeout(r, 2000));
    }

    const response = await fetch(`${GOOGLE_PLACES_BASE}/nearbysearch/json?${params}`);
    if (!response.ok) throw new Error(`Google Places HTTP ${response.status}`);

    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places: ${data.status} — ${data.error_message || ''}`);
    }

    for (const place of data.results || []) {
      results.push({
        place_id: place.place_id,
        name: place.name,
        description: '',
        address: place.vicinity || '',
        category: mapTypesToCategory(place.types),
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        photo_reference: place.photos?.[0]?.photo_reference || null,
        price_level: place.price_level ?? null,
        google_rating: place.rating ?? null,
      });
    }

    pageToken = data.next_page_token || null;
    pages++;
  } while (pageToken && pages < 2);

  return results;
};

// Consulta cada tipo de comida por separado y deduplica por place_id.
// Costo máx: 5 tipos × 2 páginas × $0.032 = $0.32 por zona nueva (una sola vez, luego todo en caché).
const fetchNearbyPlaces = async (lat, lng, radius = 2000) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const seen = new Set();
  const places = [];

  for (const type of FOOD_TYPES) {
    const results = await fetchByType(apiKey, lat, lng, radius, type);
    for (const place of results) {
      if (!seen.has(place.place_id)) {
        seen.add(place.place_id);
        places.push(place);
      }
    }
  }

  return places;
};

// Place Details: llamado lazy cuando el usuario abre un lugar. Costo: $0.017/lugar (una sola vez, se cachea).
const fetchPlaceDetails = async (placeId) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'formatted_address,formatted_phone_number,website,opening_hours,price_level,rating',
    language: 'es',
    key: apiKey,
  });

  const response = await fetch(`${GOOGLE_PLACES_BASE}/details/json?${params}`);
  if (!response.ok) throw new Error(`Google Place Details HTTP ${response.status}`);

  const data = await response.json();
  if (data.status !== 'OK') throw new Error(`Google Place Details: ${data.status}`);

  const r = data.result;
  return {
    address: r.formatted_address || null,
    phone_number: r.formatted_phone_number || null,
    website: r.website || null,
    opening_hours: r.opening_hours?.weekday_text || null,
    price_level: r.price_level ?? null,
    google_rating: r.rating ?? null,
  };
};

// Place Photo: sigue el redirect de Google para obtener la URL CDN cacheable. Costo: $0.007/foto (una sola vez).
const fetchPhotoUrl = async (photoReference, maxWidth = 800) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const params = new URLSearchParams({
    maxwidth: String(maxWidth),
    photoreference: photoReference,
    key: apiKey,
  });

  const response = await fetch(`${GOOGLE_PLACES_BASE}/photo?${params}`, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Google Place Photo HTTP ${response.status}`);

  return response.url;
};

module.exports = { fetchNearbyPlaces, fetchPlaceDetails, fetchPhotoUrl, CATEGORY_MAP };
