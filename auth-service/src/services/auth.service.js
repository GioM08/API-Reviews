const Auth = require("../models/auth.model.js");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { signToken } = require("../utils/jwt.util.js");
const { publishUserCreated } = require("../utils/broker.util.js");
const {
  sendVerificationCode,
  sendPasswordResetCode
} = require("../utils/mail.util.js");

const CODE_EXPIRES_MINUTES = Number(process.env.VERIFICATION_CODE_EXPIRES_MINUTES) || 10;
const RESEND_COOLDOWN_SECONDS = Number(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS) || 60;

const PASSWORD_RESET_CODE_EXPIRES_MINUTES = Number(process.env.PASSWORD_RESET_CODE_EXPIRES_MINUTES) || 10;
const PASSWORD_RESET_COOLDOWN_SECONDS = Number(process.env.PASSWORD_RESET_COOLDOWN_SECONDS) || 60;

const normalizeEmail = (email) => email.toLowerCase().trim();

const generateVerificationCode = () => {
  return String(crypto.randomInt(100000, 1000000));
};

const publishUserCreatedSafely = async (user) => {
  if (user.userCreatedPublished) return;

  try {
    await publishUserCreated({
      authId: user._id,
      email: user.email,
      role: user.role
    });

    user.userCreatedPublished = true;
    await user.save();
  } catch (error) {
    console.error("No se pudo publicar el evento userCreated:", error.message);
  }
};

const register = async ({ email, password }, role = "user") => {
  const normalizedEmail = normalizeEmail(email);

  const exists = await Auth.findOne({ email: normalizedEmail }).select("+verificationCodeHash");
  if (exists) {
    if (exists.emailVerified) throw new Error("Usuario ya existe");

    if (exists.verificationCodeSentAt) {
      const secondsSince = Math.floor((Date.now() - exists.verificationCodeSentAt.getTime()) / 1000);
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        throw new Error(
          `Ya tienes una cuenta pendiente de verificación. Revisa tu correo o espera ${RESEND_COOLDOWN_SECONDS - secondsSince} segundos para solicitar un nuevo código.`
        );
      }
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);

    try {
      await sendVerificationCode(exists.email, code);
    } catch (error) {
      throw new Error("No se pudo enviar el correo de verificación");
    }

    exists.verificationCodeHash = codeHash;
    exists.verificationCodeExpiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);
    exists.verificationCodeSentAt = new Date();
    await exists.save();

    return {
      id: exists._id,
      email: exists.email,
      role: exists.role,
      emailVerified: false,
      message: "Ya tienes una cuenta pendiente de verificación. Te hemos reenviado el código a tu correo."
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  if (role === "admin") {
    const admin = await Auth.create({
      email: normalizedEmail,
      password: hashedPassword,
      role,
      emailVerified: true
    });

    await publishUserCreatedSafely(admin);

    return {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      emailVerified: admin.emailVerified
    };
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);

  const user = await Auth.create({
    email: normalizedEmail,
    password: hashedPassword,
    role,
    emailVerified: false,
    verificationCodeHash: codeHash,
    verificationCodeExpiresAt: new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000),
    verificationCodeSentAt: new Date()
  });

  try {
    await sendVerificationCode(user.email, code);
  } catch (error) {
    await Auth.deleteOne({ _id: user._id });
    throw new Error("No se pudo enviar el correo de verificación");
  }

  return {
    id: user._id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    message: "Registro exitoso. Revisa tu correo para verificar tu cuenta."
  };
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await Auth.findOne({ email: normalizedEmail });
  if (!user) throw new Error("Usuario no encontrado");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Credenciales inválidas");

  if (!user.emailVerified) {
    throw new Error("Debes verificar tu correo electrónico antes de iniciar sesión");
  }

  if (user.banned) {
    throw new Error("Tu cuenta ha sido suspendida. Contacta al soporte para más información.");
  }

  const token = signToken({
    id: user._id,
    role: user.role
  });

  return { token };
};

const verifyEmail = async ({ email, code }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await Auth.findOne({ email: normalizedEmail }).select("+verificationCodeHash");
  if (!user) throw new Error("Usuario no encontrado");

  if (user.emailVerified) {
    return {
      emailVerified: true,
      message: "El correo ya estaba verificado"
    };
  }

  if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
    throw new Error("No hay código de verificación activo");
  }

  if (user.verificationCodeExpiresAt < new Date()) {
    throw new Error("El código de verificación expiró");
  }

  const validCode = await bcrypt.compare(code, user.verificationCodeHash);
  if (!validCode) throw new Error("Código de verificación inválido");

  user.emailVerified = true;
  user.verificationCodeHash = null;
  user.verificationCodeExpiresAt = null;
  user.verificationCodeSentAt = null;

  await user.save();
  await publishUserCreatedSafely(user);

  return {
    emailVerified: true,
    message: "Correo verificado correctamente"
  };
};

const resendVerificationCode = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await Auth.findOne({ email: normalizedEmail }).select("+verificationCodeHash");
  if (!user) throw new Error("Usuario no encontrado");

  if (user.emailVerified) {
    return {
      emailVerified: true,
      message: "El correo ya está verificado"
    };
  }

  if (user.verificationCodeSentAt) {
    const secondsSinceLastCode = Math.floor((Date.now() - user.verificationCodeSentAt.getTime()) / 1000);

    if (secondsSinceLastCode < RESEND_COOLDOWN_SECONDS) {
      throw new Error(`Espera ${RESEND_COOLDOWN_SECONDS - secondsSinceLastCode} segundos para reenviar el código`);
    }
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);

  try {
    await sendVerificationCode(user.email, code);
  } catch (error) {
    throw new Error("No se pudo enviar el correo de verificación");
  }

  user.verificationCodeHash = codeHash;
  user.verificationCodeExpiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);
  user.verificationCodeSentAt = new Date();

  await user.save();

  return {
    emailVerified: false,
    message: "Código de verificación reenviado correctamente"
  };
};

const forgotPassword = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await Auth.findOne({ email: normalizedEmail }).select("+passwordResetCodeHash");

  if (!user) {
    throw new Error("No existe una cuenta registrada con ese correo");
  }

  if (user.passwordResetCodeSentAt) {
    const secondsSinceLastCode = Math.floor(
      (Date.now() - user.passwordResetCodeSentAt.getTime()) / 1000
    );

    if (secondsSinceLastCode < PASSWORD_RESET_COOLDOWN_SECONDS) {
      throw new Error(
        `Espera ${PASSWORD_RESET_COOLDOWN_SECONDS - secondsSinceLastCode} segundos para solicitar otro código`
      );
    }
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);

  user.passwordResetCodeHash = codeHash;
  user.passwordResetCodeExpiresAt = new Date(
    Date.now() + PASSWORD_RESET_CODE_EXPIRES_MINUTES * 60 * 1000
  );
  user.passwordResetCodeSentAt = new Date();

  await user.save();
  await sendPasswordResetCode(user.email, code);

  return {
    message: "Código enviado correctamente. Revisa tu correo."
  };
};

const resetPassword = async ({ email, code, newPassword }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await Auth.findOne({ email: normalizedEmail }).select("+passwordResetCodeHash");
  if (!user) throw new Error("Usuario no encontrado");

  if (!user.passwordResetCodeHash || !user.passwordResetCodeExpiresAt) {
    throw new Error("No hay código activo para restablecer la contraseña");
  }

  if (user.passwordResetCodeExpiresAt < new Date()) {
    throw new Error("El código para restablecer la contraseña expiró");
  }

  const validCode = await bcrypt.compare(code, user.passwordResetCodeHash);
  if (!validCode) throw new Error("Código inválido");

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  user.password = hashedPassword;
  user.passwordResetCodeHash = null;
  user.passwordResetCodeExpiresAt = null;
  user.passwordResetCodeSentAt = null;

  await user.save();

  return {
    message: "Contraseña actualizada correctamente"
  };
};

const banUser = async (userId, reason) => {
  const user = await Auth.findById(userId);
  if (!user) throw new Error("Usuario no encontrado");
  if (user.role === "admin") throw new Error("No se puede banear a un administrador");

  user.banned = true;
  user.bannedAt = new Date();
  user.banReason = reason || null;
  await user.save();

  return { id: user._id, email: user.email, banned: true, bannedAt: user.bannedAt, banReason: user.banReason };
};

const unbanUser = async (userId) => {
  const user = await Auth.findById(userId);
  if (!user) throw new Error("Usuario no encontrado");

  user.banned = false;
  user.bannedAt = null;
  user.banReason = null;
  await user.save();

  return { id: user._id, email: user.email, banned: false };
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  banUser,
  unbanUser,
};