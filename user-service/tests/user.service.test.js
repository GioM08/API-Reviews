const userService = require("../src/services/user.service");
const User = require("../src/models/user.model");

describe("User service", () => {
  describe("createInitialProfile", () => {
    test("debe crear un perfil inicial si no existe", async () => {
      const userData = {
        authId: "auth-123",
        email: "usuario@test.com"
      };

      const user = await userService.createInitialProfile(userData);

      expect(user).toHaveProperty("_id");
      expect(user.authId).toBe("auth-123");
      expect(user.email).toBe("usuario@test.com");
      expect(user.name).toBe("");
      expect(user.avatar).toBe("default-avatar.png");
      expect(user.bio).toBe("");
    });

    test("debe devolver el perfil existente si ya existe el authId", async () => {
      await User.create({
        authId: "auth-123",
        email: "usuario@test.com",
        name: "Usuario Existente"
      });

      const user = await userService.createInitialProfile({
        authId: "auth-123",
        email: "otro@test.com"
      });

      expect(user.authId).toBe("auth-123");
      expect(user.email).toBe("usuario@test.com");
      expect(user.name).toBe("Usuario Existente");
    });
  });

  describe("updateProfile", () => {
    test("debe actualizar name, bio y avatar del usuario", async () => {
      await User.create({
        authId: "auth-456",
        email: "usuario@test.com"
      });

      const updatedUser = await userService.updateProfile("auth-456", {
        name: "Nuevo Nombre",
        bio: "Nueva bio",
        avatar: "nuevo-avatar.png"
      });

      expect(updatedUser.name).toBe("Nuevo Nombre");
      expect(updatedUser.bio).toBe("Nueva bio");
      expect(updatedUser.avatar).toBe("nuevo-avatar.png");
    });

    test("debe devolver null si el usuario no existe", async () => {
      const updatedUser = await userService.updateProfile("auth-inexistente", {
        name: "Nombre"
      });

      expect(updatedUser).toBeNull();
    });
  });
});