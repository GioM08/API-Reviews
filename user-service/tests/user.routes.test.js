const request = require("supertest");

jest.mock("../src/utils/jwt.util", () => ({
  verifyToken: jest.fn(() => ({
    id: "auth-123"
  }))
}));

const app = require("../src/app");
const User = require("../src/models/user.model");

describe("User routes", () => {
  describe("GET /api/users/:id/profile", () => {
    test("debe devolver 404 si el usuario no existe", async () => {
      const response = await request(app)
        .get("/api/users/auth-id-inexistente/profile");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Usuario no encontrado");
    });

    test("debe devolver el perfil público de un usuario existente", async () => {
      await User.create({
        authId: "auth-123",
        email: "usuario@test.com",
        name: "Usuario Test",
        avatar: "avatar.png",
        bio: "Bio de prueba"
      });

      const response = await request(app)
        .get("/api/users/auth-123/profile");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authId", "auth-123");
      expect(response.body).toHaveProperty("name", "Usuario Test");
      expect(response.body).toHaveProperty("avatar", "avatar.png");
      expect(response.body).toHaveProperty("bio", "Bio de prueba");
      expect(response.body).not.toHaveProperty("email");
    });
  });

  describe("POST /api/users/internal/batch", () => {
    test("debe devolver objeto vacío si ids no es un arreglo válido", async () => {
      const response = await request(app)
        .post("/api/users/internal/batch")
        .send({ ids: null });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    test("debe devolver objeto vacío si ids viene vacío", async () => {
      const response = await request(app)
        .post("/api/users/internal/batch")
        .send({ ids: [] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    test("debe devolver usuarios por lote usando authId como llave", async () => {
      await User.create([
        {
          authId: "auth-1",
          email: "uno@test.com",
          name: "Usuario Uno",
          avatar: "uno.png"
        },
        {
          authId: "auth-2",
          email: "dos@test.com",
          name: "Usuario Dos",
          avatar: "dos.png"
        }
      ]);

      const response = await request(app)
        .post("/api/users/internal/batch")
        .send({ ids: ["auth-1", "auth-2", "auth-3"] });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        "auth-1": {
          name: "Usuario Uno",
          avatar: "uno.png"
        },
        "auth-2": {
          name: "Usuario Dos",
          avatar: "dos.png"
        }
      });
    });
  });
    describe("GET /api/users/me", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app)
        .get("/api/users/me");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe devolver el perfil del usuario autenticado", async () => {
      await User.create({
        authId: "auth-123",
        email: "usuario@test.com",
        name: "Usuario Autenticado",
        avatar: "avatar.png",
        bio: "Bio autenticada"
      });

      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", "Bearer fake-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authId", "auth-123");
      expect(response.body).toHaveProperty("email", "usuario@test.com");
      expect(response.body).toHaveProperty("name", "Usuario Autenticado");
    });

    test("debe devolver 404 si el perfil autenticado no existe", async () => {
      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", "Bearer fake-token");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Perfil no encontrado");
    });
  });

  describe("PUT /api/users/me", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app)
        .put("/api/users/me")
        .send({
          name: "Nombre Nuevo"
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe actualizar el perfil del usuario autenticado", async () => {
      await User.create({
        authId: "auth-123",
        email: "usuario@test.com"
      });

      const response = await request(app)
        .put("/api/users/me")
        .set("Authorization", "Bearer fake-token")
        .send({
          name: "Nombre Actualizado",
          bio: "Bio actualizada",
          avatar: "avatar-actualizado.png"
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authId", "auth-123");
      expect(response.body).toHaveProperty("name", "Nombre Actualizado");
      expect(response.body).toHaveProperty("bio", "Bio actualizada");
      expect(response.body).toHaveProperty("avatar", "avatar-actualizado.png");
    });
  });
});