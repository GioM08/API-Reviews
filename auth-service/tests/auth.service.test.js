const Auth = require("../src/models/auth.model");

jest.mock("../src/utils/broker.util.js", () => ({
  publishUserCreated: jest.fn()
}));

jest.mock("../src/utils/jwt.util.js", () => ({
  signToken: jest.fn(() => "fake-jwt-token")
}));

const authService = require("../src/services/auth.service");
const { publishUserCreated } = require("../src/utils/broker.util");
const { signToken } = require("../src/utils/jwt.util");

describe("Auth service", () => {
  describe("register", () => {
    test("debe registrar un usuario nuevo", async () => {
      const result = await authService.register({
        email: "usuario@test.com",
        password: "123456"
      });

      expect(result).toHaveProperty("id");
      expect(result.email).toBe("usuario@test.com");
      expect(result.role).toBe("user");

      const userInDb = await Auth.findOne({ email: "usuario@test.com" });

      expect(userInDb).not.toBeNull();
      expect(userInDb.email).toBe("usuario@test.com");
      expect(userInDb.password).not.toBe("123456");

      expect(publishUserCreated).toHaveBeenCalledTimes(1);
      expect(publishUserCreated).toHaveBeenCalledWith({
        authId: userInDb._id,
        email: "usuario@test.com",
        role: "user"
      });
    });

    test("debe registrar un usuario con rol admin", async () => {
      const result = await authService.register({
        email: "admin@test.com",
        password: "123456"
      }, "admin");

      expect(result.role).toBe("admin");

      const userInDb = await Auth.findOne({ email: "admin@test.com" });
      expect(userInDb.role).toBe("admin");
    });

    test("debe lanzar error si el usuario ya existe", async () => {
      await authService.register({
        email: "duplicado@test.com",
        password: "123456"
      });

      await expect(authService.register({
        email: "duplicado@test.com",
        password: "123456"
      })).rejects.toThrow("Usuario ya existe");
    });
  });

  describe("login", () => {
    test("debe iniciar sesión con credenciales válidas", async () => {
      await authService.register({
        email: "login@test.com",
        password: "123456"
      });

      const result = await authService.login({
        email: "login@test.com",
        password: "123456"
      });

      expect(result).toEqual({
        token: "fake-jwt-token"
      });

      expect(signToken).toHaveBeenCalledTimes(1);
      expect(signToken).toHaveBeenCalledWith(expect.objectContaining({
        role: "user"
      }));
    });

    test("debe lanzar error si el usuario no existe", async () => {
      await expect(authService.login({
        email: "noexiste@test.com",
        password: "123456"
      })).rejects.toThrow("Usuario no encontrado");
    });

    test("debe lanzar error si la contraseña es incorrecta", async () => {
      await authService.register({
        email: "password@test.com",
        password: "123456"
      });

      await expect(authService.login({
        email: "password@test.com",
        password: "incorrecta"
      })).rejects.toThrow("Credenciales inválidas");
    });
  });
});