jest.mock("../src/config/db", () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock("../src/utils/google-places.util", () => ({
  fetchNearbyPlaces: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  fetchPhotoUrl: jest.fn()
}));

jest.mock("../src/utils/broker.util", () => ({
  publishRestaurantCreated: jest.fn()
}));

const { pool } = require("../src/config/db");
const {
  fetchNearbyPlaces,
  fetchPlaceDetails,
  fetchPhotoUrl
} = require("../src/utils/google-places.util");
const { publishRestaurantCreated } = require("../src/utils/broker.util");

const service = require("../src/services/restaurant.service");

describe("Restaurant service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRestaurants", () => {
    test("debe devolver restaurantes ordenados desde la base de datos", async () => {
      const restaurants = [
        { id: 1, name: "Restaurante Uno", score: 4.8 },
        { id: 2, name: "Restaurante Dos", score: 4.5 }
      ];

      pool.query.mockResolvedValueOnce({ rows: restaurants });

      const result = await service.getRestaurants();

      expect(result).toEqual(restaurants);
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM restaurants ORDER BY score DESC, google_rating DESC NULLS LAST"
      );
    });
  });

  describe("getRestaurantById", () => {
    test("debe devolver null si el restaurante no existe", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getRestaurantById(999);

      expect(result).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM restaurants WHERE id = $1",
        [999]
      );
    });

    test("debe devolver restaurante sin consultar Google si ya tiene detalles", async () => {
      const restaurant = {
        id: 1,
        name: "Restaurante Test",
        details_fetched: true,
        place_id: "place-123"
      };

      pool.query.mockResolvedValueOnce({ rows: [restaurant] });

      const result = await service.getRestaurantById(1);

      expect(result).toEqual(restaurant);
      expect(fetchPlaceDetails).not.toHaveBeenCalled();
    });

    test("debe consultar y guardar detalles si el restaurante tiene place_id y no tiene detalles", async () => {
      const restaurant = {
        id: 1,
        name: "Restaurante Test",
        address: "",
        details_fetched: false,
        place_id: "place-123"
      };

      const details = {
        address: "Dirección actualizada",
        phone_number: "2281234567",
        website: "https://restaurante.test",
        opening_hours: ["Lunes: 9:00 - 18:00"],
        price_level: 2,
        google_rating: 4.7
      };

      pool.query
        .mockResolvedValueOnce({ rows: [restaurant] })
        .mockResolvedValueOnce({ rows: [] });

      fetchPlaceDetails.mockResolvedValueOnce(details);

      const result = await service.getRestaurantById(1);

      expect(fetchPlaceDetails).toHaveBeenCalledWith("place-123");
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(result.address).toBe("Dirección actualizada");
      expect(result.phone_number).toBe("2281234567");
      expect(result.website).toBe("https://restaurante.test");
      expect(result.details_fetched).toBe(true);
    });
  });

  describe("getRestaurantPhotoUrl", () => {
    test("debe devolver null si el restaurante no existe", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getRestaurantPhotoUrl(999);

      expect(result).toBeNull();
    });

    test("debe devolver photo_url si ya está cacheada", async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            photo_reference: "photo-ref",
            photo_url: "https://cdn.test/foto.jpg"
          }
        ]
      });

      const result = await service.getRestaurantPhotoUrl(1);

      expect(result).toBe("https://cdn.test/foto.jpg");
      expect(fetchPhotoUrl).not.toHaveBeenCalled();
    });

    test("debe devolver null si no hay photo_reference", async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            photo_reference: null,
            photo_url: null
          }
        ]
      });

      const result = await service.getRestaurantPhotoUrl(1);

      expect(result).toBeNull();
      expect(fetchPhotoUrl).not.toHaveBeenCalled();
    });

    test("debe consultar foto en Google y actualizar photo_url", async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              photo_reference: "photo-ref",
              photo_url: null
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      fetchPhotoUrl.mockResolvedValueOnce("https://cdn.test/foto-final.jpg");

      const result = await service.getRestaurantPhotoUrl(1);

      expect(fetchPhotoUrl).toHaveBeenCalledWith("photo-ref");
      expect(pool.query).toHaveBeenLastCalledWith(
        "UPDATE restaurants SET photo_url = $1 WHERE id = $2",
        ["https://cdn.test/foto-final.jpg", 1]
      );
      expect(result).toBe("https://cdn.test/foto-final.jpg");
    });
  });

  describe("getNearbyRestaurants", () => {
    test("debe devolver restaurantes cercanos desde caché si ya hay suficientes resultados", async () => {
      const restaurants = [
        { id: 1, name: "Restaurante Cercano", score: 4.9 }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: "10" }] })
        .mockResolvedValueOnce({ rows: restaurants });

      const result = await service.getNearbyRestaurants(19.5438, -96.9102, 2000);

      expect(fetchNearbyPlaces).not.toHaveBeenCalled();
      expect(result).toEqual(restaurants);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test("debe aplicar filtro por categoría si se proporciona", async () => {
      const restaurants = [
        { id: 1, name: "Café Test", category: "Café" }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: "10" }] })
        .mockResolvedValueOnce({ rows: restaurants });

      const result = await service.getNearbyRestaurants(19.5438, -96.9102, 2000, "Café");

      expect(result).toEqual(restaurants);
      expect(pool.query.mock.calls[1][0]).toContain("AND category");
      expect(pool.query.mock.calls[1][1]).toContain("Café");
    });

    test("debe consultar Google Places e insertar restaurantes si hay pocos resultados en la zona", async () => {
      const googlePlaces = [
        {
          name: "Google Restaurant",
          description: "",
          address: "Calle 1",
          category: "Restaurante",
          latitude: 19.54,
          longitude: -96.91,
          place_id: "place-1",
          photo_reference: "photo-1",
          price_level: 2,
          google_rating: 4.5
        },
        {
          name: "Google Café",
          description: "",
          address: "Calle 2",
          category: "Café",
          latitude: 19.55,
          longitude: -96.92,
          place_id: "place-2",
          photo_reference: "photo-2",
          price_level: 1,
          google_rating: 4.2
        }
      ];

      const insertedRestaurant = {
        id: 1,
        name: "Google Restaurant",
        place_id: "place-1"
      };

      const finalRestaurants = [
        insertedRestaurant
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValueOnce({ rows: [insertedRestaurant] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: finalRestaurants });

      fetchNearbyPlaces.mockResolvedValueOnce(googlePlaces);

      const result = await service.getNearbyRestaurants(19.5438, -96.9102, 2000);

      expect(fetchNearbyPlaces).toHaveBeenCalledWith(19.5438, -96.9102, 2000);
      expect(publishRestaurantCreated).toHaveBeenCalledTimes(1);
      expect(publishRestaurantCreated).toHaveBeenCalledWith(insertedRestaurant);
      expect(result).toEqual(finalRestaurants);
    });
  });

  describe("updateScore", () => {
    test("debe actualizar score y review_count del restaurante", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.updateScore(1, 5);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE restaurants"),
        [5, 1]
      );
    });
  });

  describe("updateRestaurantStats", () => {
    test("debe actualizar detailed_ratings_avg y amenities_stats del restaurante", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const detailedRatingsAvg = {
        food: 4.5,
        service: 4.2,
        ambience: 4.8
      };

      const amenitiesStats = {
        wifi: 10,
        parking: 5,
        petFriendly: 3
      };

      await service.updateRestaurantStats(1, detailedRatingsAvg, amenitiesStats);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE restaurants"),
        [
          JSON.stringify(detailedRatingsAvg),
          JSON.stringify(amenitiesStats),
          1
        ]
      );
    });
  });
});