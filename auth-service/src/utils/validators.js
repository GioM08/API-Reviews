const { z } = require("zod");

const passwordSchema = z.string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula")
  .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número")
  .regex(/[^A-Za-z0-9]/, "La contraseña debe incluir al menos un carácter especial")
  .regex(/^\S+$/, "La contraseña no debe contener espacios");

const registerSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  password: passwordSchema
});

const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  password: z.string().min(1, "La contraseña es obligatoria")
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos")
});

const resendVerificationCodeSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido")
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido")
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  newPassword: passwordSchema
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};