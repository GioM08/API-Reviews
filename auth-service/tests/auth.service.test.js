const bcrypt = require("bcrypt");
const Auth = require("../src/models/auth.model");

jest.mock("../src/utils/broker.util.js", () => ({
  publishUserCreated: jest.fn()
}));

jest.mock("../src/utils/jwt.util.js", () => ({
  signToken: jest.fn(() => "fake-jwt-token")
}));

jest.mock("../src/utils/mail.util.js", () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined)
}));

const authService = require("../src/services/auth.service");
const { publishUserCreated } = require("../src/utils/broker.util");
const { signToken } = require("../src/utils/jwt.util");
const {
  sendVerificationCode,
  sendPasswordResetCode
} = require("../src/utils/mail.util");

describe("Auth service", () => {
  describe("register", () => {
    test("debe registrar un usuario nuevo sin verificar correo", async () => {
      const result = await authService.register({
        email: "Usuario@Test.com",
        password: "Test123!"
      });

      expect(result).toHaveProperty("id");
      expect(result.email).toBe("usuario@test.com");
      expect(result.role).toBe("user");
      expect(result.emailVerified).toBe(false);
      expect(result.message).toBe("Registro exitoso. Revisa tu correo para verificar tu cuenta.");

      const userInDb = await Auth.findOne({ email: "usuario@test.com" }).select("+verificationCodeHash");

      expect(userInDb).not.toBeNull();
      expect(userInDb.emailVerified).toBe(false);
      expect(userInDb.password).not.toBe("Test123!");
      expect(userInDb.verificationCodeHash).toBeTruthy();

      expect(sendVerificationCode).toHaveBeenCalledTimes(1);
      expect(sendVerificationCode).toHaveBeenCalledWith(
        "usuario@test.com",
        expect.stringMatching(/^\d{6}$/)
      );

      expect(publishUserCreated).not.toHaveBeenCalled();
    });

    test("debe registrar un usuario admin ya verificado y publicar evento", async () => {
      const result = await authService.register({
        email: "Admin@Test.com",
        password: "Admin123!"
      }, "admin");

      expect(result.email).toBe("admin@test.com");
      expect(result.role).toBe("admin");
      expect(result.emailVerified).toBe(true);

      const userInDb = await Auth.findOne({ email: "admin@test.com" });

      expect(userInDb).not.toBeNull();
      expect(userInDb.emailVerified).toBe(true);
      expect(userInDb.userCreatedPublished).toBe(true);

      expect(publishUserCreated).toHaveBeenCalledTimes(1);
      expect(publishUserCreated).toHaveBeenCalledWith({
        authId: userInDb._id,
        email: "admin@test.com",
        role: "admin"
      });
    });

    test("debe lanzar error si el usuario ya existe", async () => {
      await authService.register({
        email: "duplicado@test.com",
        password: "Test123!"
      });

      await expect(authService.register({
        email: "duplicado@test.com",
        password: "Test123!"
      })).rejects.toThrow("Usuario ya existe");
    });
  });

  describe("login", () => {
    test("debe iniciar sesión con credenciales válidas si el correo está verificado", async () => {
      await authService.register({
        email: "login@test.com",
        password: "Test123!"
      });

      await Auth.updateOne(
        { email: "login@test.com" },
        { emailVerified: true }
      );

      const result = await authService.login({
        email: "login@test.com",
        password: "Test123!"
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
        password: "Test123!"
      })).rejects.toThrow("Usuario no encontrado");
    });

    test("debe lanzar error si la contraseña es incorrecta", async () => {
      await authService.register({
        email: "password@test.com",
        password: "Test123!"
      });

      await Auth.updateOne(
        { email: "password@test.com" },
        { emailVerified: true }
      );

      await expect(authService.login({
        email: "password@test.com",
        password: "Incorrecta123!"
      })).rejects.toThrow("Credenciales inválidas");
    });

    test("debe lanzar error si el correo no está verificado", async () => {
      await authService.register({
        email: "unverified@test.com",
        password: "Test123!"
      });

      await expect(authService.login({
        email: "unverified@test.com",
        password: "Test123!"
      })).rejects.toThrow("Debes verificar tu correo electrónico antes de iniciar sesión");

      expect(signToken).not.toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    test("debe verificar correo y publicar evento userCreated", async () => {
      await authService.register({
        email: "verify@test.com",
        password: "Test123!"
      });

      const code = sendVerificationCode.mock.calls[0][1];

      const result = await authService.verifyEmail({
        email: "verify@test.com",
        code
      });

      expect(result.emailVerified).toBe(true);
      expect(result.message).toBe("Correo verificado correctamente");

      const userInDb = await Auth.findOne({ email: "verify@test.com" }).select("+verificationCodeHash");

      expect(userInDb.emailVerified).toBe(true);
      expect(userInDb.verificationCodeHash).toBeNull();
      expect(userInDb.verificationCodeExpiresAt).toBeNull();
      expect(userInDb.verificationCodeSentAt).toBeNull();
      expect(userInDb.userCreatedPublished).toBe(true);

      expect(publishUserCreated).toHaveBeenCalledTimes(1);
      expect(publishUserCreated).toHaveBeenCalledWith({
        authId: userInDb._id,
        email: "verify@test.com",
        role: "user"
      });
    });

    test("debe lanzar error si el código de verificación es inválido", async () => {
      await authService.register({
        email: "invalid-code@test.com",
        password: "Test123!"
      });

      await expect(authService.verifyEmail({
        email: "invalid-code@test.com",
        code: "000000"
      })).rejects.toThrow("Código de verificación inválido");
    });
  });

  describe("resendVerificationCode", () => {
    test("debe reenviar código si ya pasó el tiempo de espera", async () => {
      await authService.register({
        email: "resend@test.com",
        password: "Test123!"
      });

      await Auth.updateOne(
        { email: "resend@test.com" },
        {
          verificationCodeSentAt: new Date(Date.now() - 61 * 1000)
        }
      );

      const result = await authService.resendVerificationCode({
        email: "resend@test.com"
      });

      expect(result.emailVerified).toBe(false);
      expect(result.message).toBe("Código de verificación reenviado correctamente");

      expect(sendVerificationCode).toHaveBeenCalledTimes(2);
    });

    test("debe lanzar error si se intenta reenviar antes del cooldown", async () => {
      await authService.register({
        email: "cooldown@test.com",
        password: "Test123!"
      });

      await expect(authService.resendVerificationCode({
        email: "cooldown@test.com"
      })).rejects.toThrow(/Espera/);
    });
  });

  describe("forgotPassword y resetPassword", () => {
    test("debe enviar código y restablecer contraseña correctamente", async () => {
      const oldPasswordHash = await bcrypt.hash("Old123!", 10);

      await Auth.create({
        email: "reset@test.com",
        password: oldPasswordHash,
        role: "user",
        emailVerified: true
      });

      const forgotResult = await authService.forgotPassword({
        email: "reset@test.com"
      });

      expect(forgotResult.message).toBe("Código enviado correctamente. Revisa tu correo.");

      expect(sendPasswordResetCode).toHaveBeenCalledTimes(1);
      expect(sendPasswordResetCode).toHaveBeenCalledWith(
        "reset@test.com",
        expect.stringMatching(/^\d{6}$/)
      );

      const code = sendPasswordResetCode.mock.calls[0][1];

      const resetResult = await authService.resetPassword({
        email: "reset@test.com",
        code,
        newPassword: "New123!"
      });

      expect(resetResult.message).toBe("Contraseña actualizada correctamente");

      const userInDb = await Auth.findOne({ email: "reset@test.com" }).select("+passwordResetCodeHash");

      const validNewPassword = await bcrypt.compare("New123!", userInDb.password);

      expect(validNewPassword).toBe(true);
      expect(userInDb.passwordResetCodeHash).toBeNull();
      expect(userInDb.passwordResetCodeExpiresAt).toBeNull();
      expect(userInDb.passwordResetCodeSentAt).toBeNull();
    });

    test("debe lanzar error si el código de reset es inválido", async () => {
      const oldPasswordHash = await bcrypt.hash("Old123!", 10);

      await Auth.create({
        email: "bad-reset@test.com",
        password: oldPasswordHash,
        role: "user",
        emailVerified: true
      });

      await authService.forgotPassword({
        email: "bad-reset@test.com"
      });

      await expect(authService.resetPassword({
        email: "bad-reset@test.com",
        code: "000000",
        newPassword: "New123!"
      })).rejects.toThrow("Código inválido");
    });
  });
});