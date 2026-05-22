const request = require("supertest");

jest.mock("../src/utils/jwt.util", () => ({
  verifyToken: jest.fn()
}));

const app = require("../src/app");
const User = require("../src/models/user.model");
const userService = require("../src/services/user.service");
const { verifyToken } = require("../src/utils/jwt.util");

const authHeader = "Bearer fake-token";

describe("User routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    verifyToken.mockReturnValue({
      id: "auth-123"
    });
  });

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

    test("debe devolver 500 si ocurre un error al consultar perfil público", async () => {
      const findOneSpy = jest
        .spyOn(User, "findOne")
        .mockRejectedValueOnce(new Error("Error de base de datos"));

      const response = await request(app)
        .get("/api/users/auth-123/profile");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error de base de datos");

      findOneSpy.mockRestore();
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

    test("debe devolver 500 si ocurre error en consulta batch", async () => {
      const findSpy = jest
        .spyOn(User, "find")
        .mockRejectedValueOnce(new Error("Error batch"));

      const response = await request(app)
        .post("/api/users/internal/batch")
        .send({ ids: ["auth-1"] });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error batch");

      findSpy.mockRestore();
    });
  });

  describe("GET /api/users/me", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app)
        .get("/api/users/me");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe devolver 401 si el token es inválido", async () => {
      verifyToken.mockImplementationOnce(() => {
        throw new Error("Token inválido");
      });

      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", authHeader);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Token inválido");
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
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authId", "auth-123");
      expect(response.body).toHaveProperty("email", "usuario@test.com");
      expect(response.body).toHaveProperty("name", "Usuario Autenticado");

      expect(verifyToken).toHaveBeenCalledWith("fake-token");
    });

    test("debe devolver 404 si el perfil autenticado no existe", async () => {
      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", authHeader);

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

    test("debe devolver 401 si el token es inválido", async () => {
      verifyToken.mockImplementationOnce(() => {
        throw new Error("Token inválido");
      });

      const response = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeader)
        .send({
          name: "Nombre Nuevo"
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Token inválido");
    });

    test("debe actualizar el perfil del usuario autenticado", async () => {
      await User.create({
        authId: "auth-123",
        email: "usuario@test.com"
      });

      const response = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeader)
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

    test("debe devolver 500 si falla la actualización del perfil", async () => {
      jest
        .spyOn(userService, "updateProfile")
        .mockRejectedValueOnce(new Error("Error actualizando perfil"));

      const response = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeader)
        .send({
          name: "Nombre Actualizado"
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error actualizando perfil");
    });
  });
});