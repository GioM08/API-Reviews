const request = require("supertest");

jest.mock("../src/utils/broker.util.js", () => ({
  publishUserCreated: jest.fn()
}));

jest.mock("../src/utils/jwt.util.js", () => ({
  signToken: jest.fn(() => "fake-jwt-token"),
  verifyToken: jest.fn()
}));

const app = require("../src/app");
const Auth = require("../src/models/auth.model");

describe("Auth routes", () => {
  describe("GET /api/auth/health", () => {
    test("debe devolver status ok", async () => {
      const response = await request(app)
        .get("/api/auth/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("POST /api/auth/register", () => {
    test("debe registrar un usuario válido", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "usuario@test.com",
          password: "123456"
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.email).toBe("usuario@test.com");
      expect(response.body.role).toBe("user");

      const userInDb = await Auth.findOne({ email: "usuario@test.com" });
      expect(userInDb).not.toBeNull();
    });

    test("debe devolver 400 si el email no es válido", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "correo-invalido",
          password: "123456"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe devolver 400 si la contraseña tiene menos de 6 caracteres", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "usuario@test.com",
          password: "123"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe devolver 400 si el usuario ya existe", async () => {
      await Auth.create({
        email: "duplicado@test.com",
        password: "hashed-password",
        role: "user"
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "duplicado@test.com",
          password: "123456"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Usuario ya existe");
    });
  });

  describe("POST /api/auth/login", () => {
    test("debe iniciar sesión con credenciales válidas", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "login@test.com",
          password: "123456"
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@test.com",
          password: "123456"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: "fake-jwt-token"
      });
    });

    test("debe devolver 400 si el usuario no existe", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "noexiste@test.com",
          password: "123456"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Usuario no encontrado");
    });

    test("debe devolver 400 si la contraseña es incorrecta", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "wrong@test.com",
          password: "123456"
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrong@test.com",
          password: "incorrecta"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Credenciales inválidas");
    });
  });

  describe("POST /api/auth/register/admin", () => {
    test("debe devolver 403 si no se manda admin secret", async () => {
      const response = await request(app)
        .post("/api/auth/register/admin")
        .send({
          email: "admin@test.com",
          password: "123456"
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error", "Acceso denegado");
    });

    test("debe registrar admin si se manda admin secret válido", async () => {
      process.env.ADMIN_SECRET = "secret-test";

      const response = await request(app)
        .post("/api/auth/register/admin")
        .set("x-admin-secret", "secret-test")
        .send({
          email: "admin@test.com",
          password: "123456"
        });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("admin@test.com");
      expect(response.body.role).toBe("admin");
    });
  });
});