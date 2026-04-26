const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const { startConsumers } = require('./utils/consumer');
const { initFirebase } = require('./utils/firebase');

const startServer = async () => {
  try {
    await connectDB();
    initFirebase();
    await startConsumers();

    const PORT = process.env.PORT || 3007;
    app.listen(PORT, () => {
      console.log(`Notification-Service corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar Notification-Service:', error);
    process.exit(1);
  }
};

startServer();
