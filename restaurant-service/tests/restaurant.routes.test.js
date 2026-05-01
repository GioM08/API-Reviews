const request = require("supertest");

jest.mock("../src/services/restaurant.service", () => ({
  getRestaurants: jest.fn(),
  getNearbyRestaurants: jest.fn(),
  getRestaurantById: jest.fn(),
  getRestaurantPhotoUrl: jest.fn()
}));

const service = require("../src/services/restaurant.service");
const app = require("../src/app");

describe("Restaurant routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/restaurants/health", () => {
    test("debe devolver status ok", async () => {
      const response = await request(app)
        .get("/api/restaurants/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /api/restaurants/categories", () => {
    test("debe devolver las categorías disponibles", async () => {
      const response = await request(app)
        .get("/api/restaurants/categories");

      expect(response.status).toBe(200);
      expect(response.body).toContain("Restaurante");
      expect(response.body).toContain("Café");
      expect(response.body).toContain("Bar");
    });
  });

  describe("GET /api/restaurants", () => {
    test("debe devolver todos los restaurantes si no se manda ubicación", async () => {
      const restaurants = [
        { id: 1, name: "Restaurante Uno" },
        { id: 2, name: "Restaurante Dos" }
      ];

      service.getRestaurants.mockResolvedValueOnce(restaurants);

      const response = await request(app)
        .get("/api/restaurants");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(restaurants);
      expect(service.getRestaurants).toHaveBeenCalledTimes(1);
    });

    test("debe devolver restaurantes cercanos si se manda lat y lng", async () => {
      const restaurants = [
        { id: 1, name: "Restaurante Cercano" }
      ];

      service.getNearbyRestaurants.mockResolvedValueOnce(restaurants);

      const response = await request(app)
        .get("/api/restaurants")
        .query({
          lat: "19.5438",
          lng: "-96.9102",
          radius: "1500",
          category: "Café"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(restaurants);
      expect(service.getNearbyRestaurants).toHaveBeenCalledWith(
        19.5438,
        -96.9102,
        1500,
        "Café"
      );
    });

    test("debe usar radio por defecto si no se manda radius", async () => {
      service.getNearbyRestaurants.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/restaurants")
        .query({
          lat: "19.5438",
          lng: "-96.9102"
        });

      expect(response.status).toBe(200);
      expect(service.getNearbyRestaurants).toHaveBeenCalledWith(
        19.5438,
        -96.9102,
        2000,
        null
      );
    });

    test("debe devolver 500 si ocurre un error al consultar restaurantes", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      service.getRestaurants.mockRejectedValueOnce(new Error("Error de base de datos"));

      const response = await request(app)
        .get("/api/restaurants");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error de base de datos");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /api/restaurants/:id", () => {
    test("debe devolver un restaurante por id", async () => {
      const restaurant = {
        id: 1,
        name: "Restaurante Test"
      };

      service.getRestaurantById.mockResolvedValueOnce(restaurant);

      const response = await request(app)
        .get("/api/restaurants/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(restaurant);
      expect(service.getRestaurantById).toHaveBeenCalledWith("1");
    });

    test("debe devolver 404 si el restaurante no existe", async () => {
      service.getRestaurantById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/restaurants/999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Restaurante no encontrado");
    });

    test("debe devolver 500 si ocurre error buscando por id", async () => {
      service.getRestaurantById.mockRejectedValueOnce(new Error("Error interno"));

      const response = await request(app)
        .get("/api/restaurants/1");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error interno");
    });
  });

  describe("GET /api/restaurants/:id/photo", () => {
    test("debe redirigir a la foto del restaurante", async () => {
      service.getRestaurantPhotoUrl.mockResolvedValueOnce("https://cdn.test/foto.jpg");

      const response = await request(app)
        .get("/api/restaurants/1/photo");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("https://cdn.test/foto.jpg");
      expect(service.getRestaurantPhotoUrl).toHaveBeenCalledWith("1");
    });

    test("debe devolver 404 si la foto no está disponible", async () => {
      service.getRestaurantPhotoUrl.mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/restaurants/1/photo");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Foto no disponible");
    });

    test("debe devolver 500 si ocurre error al obtener foto", async () => {
      service.getRestaurantPhotoUrl.mockRejectedValueOnce(new Error("Error foto"));

      const response = await request(app)
        .get("/api/restaurants/1/photo");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error foto");
    });
  });
});