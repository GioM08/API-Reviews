const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db.js");


const startServer = async () => {
  try {
    await connectDB();
    console.log("✔ Auth-Service: Conexión a MongoDB exitosa");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Auth service corriendo en el puerto ${PORT}`);
    });

  } catch (error) {
    console.error("Error al iniciar el Auth Service:", error);
    process.exit(1);
  }
};

startServer();