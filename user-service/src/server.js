const dotenv = require("dotenv");
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const { consumeUserCreated } = require('./utils/consumer');

const startServer = async () => {
  try {
    // 1. Conexión a la Base de Datos
    await connectDB();
    console.log('✔ MongoDB conectado en User-Service');

    // 2. Conexión a RabbitMQ
    // Es vital que consumeUserCreated sea asíncrono para esperar la conexión
    await consumeUserCreated();
    console.log('✔ Escuchando eventos de RabbitMQ');

    // 3. Encender el servidor
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Servidor listo en puerto ${PORT}`);
    });

  } catch (error) {
    console.error('Error fatal al arrancar el servidor:', error);
    process.exit(1);
  }
};

startServer();