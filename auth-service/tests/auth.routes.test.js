const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../src/utils/broker.util.js", () => ({
  publishUserCreated: jest.fn()
}));

jest.mock("../src/utils/jwt.util.js", () => ({
  signToken: jest.fn(() => "fake-jwt-token"),
  verifyToken: jest.fn()
}));

jest.mock("../src/utils/mail.util.js", () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined)
}));

const app = require("../src/app");
const Auth = require("../src/models/auth.model");
const { sendVerificationCode, sendPasswordResetCode } = require("../src/utils/mail.util");

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
          password: "Test123!"
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.email).toBe("usuario@test.com");
      expect(response.body.role).toBe("user");
      expect(response.body.emailVerified).toBe(false);

      const userInDb = await Auth.findOne({ email: "usuario@test.com" });

      expect(userInDb).not.toBeNull();
      expect(userInDb.emailVerified).toBe(false);

      expect(sendVerificationCode).toHaveBeenCalledTimes(1);
    });

    test("debe devolver 400 si el email no es válido", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "correo-invalido",
          password: "Test123!"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe devolver 400 si la contraseña no cumple las reglas", async () => {
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
          password: "Test123!"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Usuario ya existe");
    });
  });

  describe("POST /api/auth/login", () => {
    test("debe iniciar sesión con credenciales válidas si el correo está verificado", async () => {
      const passwordHash = await bcrypt.hash("Test123!", 10);

      await Auth.create({
        email: "login@test.com",
        password: passwordHash,
        role: "user",
        emailVerified: true
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@test.com",
          password: "Test123!"
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
          password: "Test123!"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Usuario no encontrado");
    });

    test("debe devolver 400 si la contraseña es incorrecta", async () => {
      const passwordHash = await bcrypt.hash("Test123!", 10);

      await Auth.create({
        email: "wrong@test.com",
        password: passwordHash,
        role: "user",
        emailVerified: true
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrong@test.com",
          password: "Incorrecta123!"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Credenciales inválidas");
    });

    test("debe devolver 400 si el correo no está verificado", async () => {
      const passwordHash = await bcrypt.hash("Test123!", 10);

      await Auth.create({
        email: "unverified@test.com",
        password: passwordHash,
        role: "user",
        emailVerified: false
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "unverified@test.com",
          password: "Test123!"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Debes verificar tu correo electrónico antes de iniciar sesión"
      );
    });
  });

  describe("POST /api/auth/verify-email", () => {
    test("debe verificar correo con código válido", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "verify@test.com",
          password: "Test123!"
        });

      const code = sendVerificationCode.mock.calls[0][1];

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({
          email: "verify@test.com",
          code
        });

      expect(response.status).toBe(200);
      expect(response.body.emailVerified).toBe(true);
      expect(response.body.message).toBe("Correo verificado correctamente");

      const userInDb = await Auth.findOne({ email: "verify@test.com" });

      expect(userInDb.emailVerified).toBe(true);
    });

    test("debe devolver 400 si el código es inválido", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "invalid-code@test.com",
          password: "Test123!"
        });

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({
          email: "invalid-code@test.com",
          code: "000000"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Código de verificación inválido");
    });
  });

  describe("POST /api/auth/forgot-password y /reset-password", () => {
    test("debe solicitar código y restablecer contraseña", async () => {
      const passwordHash = await bcrypt.hash("Old123!", 10);

      await Auth.create({
        email: "reset@test.com",
        password: passwordHash,
        role: "user",
        emailVerified: true
      });

      const forgotResponse = await request(app)
        .post("/api/auth/forgot-password")
        .send({
          email: "reset@test.com"
        });

      expect(forgotResponse.status).toBe(200);
      expect(forgotResponse.body.message).toBe("Código enviado correctamente. Revisa tu correo.");

      const code = sendPasswordResetCode.mock.calls[0][1];

      const resetResponse = await request(app)
        .post("/api/auth/reset-password")
        .send({
          email: "reset@test.com",
          code,
          newPassword: "New1234!"
        });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.message).toBe("Contraseña actualizada correctamente");

      const userInDb = await Auth.findOne({ email: "reset@test.com" });
      const validNewPassword = await bcrypt.compare("New1234!", userInDb.password);

      expect(validNewPassword).toBe(true);
    });
  });

  describe("POST /api/auth/register/admin", () => {
    test("debe devolver 403 si no se manda admin secret", async () => {
      const response = await request(app)
        .post("/api/auth/register/admin")
        .send({
          email: "admin@test.com",
          password: "Admin123!"
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
          password: "Admin123!"
        });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("admin@test.com");
      expect(response.body.role).toBe("admin");
      expect(response.body.emailVerified).toBe(true);
    });
  });
});