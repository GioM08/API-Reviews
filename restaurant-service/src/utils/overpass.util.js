const CATEGORY_MAP = {
  restaurant: 'Restaurante',
  cafe: 'Café',
  bar: 'Bar',
  fast_food: 'Comida rápida',
  pub: 'Pub',
  food_court: 'Patio de comidas',
  ice_cream: 'Heladería',
  bakery: 'Panadería',
};

const fetchNearbyPlaces = async (lat, lng, radius = 2000) => {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      node["amenity"="bar"](around:${radius},${lat},${lng});
      node["amenity"="fast_food"](around:${radius},${lat},${lng});
      node["amenity"="pub"](around:${radius},${lat},${lng});
      node["amenity"="food_court"](around:${radius},${lat},${lng});
      node["amenity"="ice_cream"](around:${radius},${lat},${lng});
      node["shop"="bakery"](around:${radius},${lat},${lng});
    );
    out 30;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'ApiReviews/1.0',
    },
    body: `data=${encodeURIComponent(query.trim())}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Overpass error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  return data.elements
    .filter(el => el.tags && el.tags.name)
    .map(el => ({
      osm_id: el.id,
      name: el.tags.name,
      description: el.tags.cuisine || el.tags.description || '',
      address: [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' ') || '',
      category: CATEGORY_MAP[el.tags.amenity] || CATEGORY_MAP[el.tags.shop] || 'Restaurante',
      latitude: el.lat,
      longitude: el.lon,
    }));
};

module.exports = { fetchNearbyPlaces, CATEGORY_MAP };
