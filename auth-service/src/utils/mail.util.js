const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendVerificationCode = async (email, code) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Faltan credenciales de correo");
  }

  const transporter = createTransporter();
  const fromName = process.env.EMAIL_FROM_NAME || "FoodRanker";

  await transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Código de verificación - FoodRanker",
    text: `Tu código de verificación de FoodRanker es: ${code}. Expira en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222;">
        <h2>Verificación de correo</h2>
        <p>Gracias por registrarte en <strong>FoodRanker</strong>.</p>
        <p>Tu código de verificación es:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>Este código expira en 10 minutos.</p>
        <p>Si tú no solicitaste este registro, puedes ignorar este correo.</p>
      </div>
    `
  });
};

const sendPasswordResetCode = async (email, code) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Faltan credenciales de correo");
  }

  const transporter = createTransporter();
  const fromName = process.env.EMAIL_FROM_NAME || "FoodRanker";

  await transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Código para restablecer contraseña - FoodRanker",
    text: `Tu código para restablecer tu contraseña de FoodRanker es: ${code}. Expira en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222;">
        <h2>Restablecer contraseña</h2>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>FoodRanker</strong>.</p>
        <p>Tu código para restablecer la contraseña es:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>Este código expira en 10 minutos.</p>
        <p>Si tú no solicitaste este cambio, puedes ignorar este correo.</p>
      </div>
    `
  });
};

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode
};