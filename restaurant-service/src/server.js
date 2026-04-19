const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { createTable } = require('./models/restaurant.model');
const { consumeReviewCreated } = require('./utils/consumer');

const startServer = async () => {
  try {
    await connectDB();
    await createTable();

    await consumeReviewCreated();
    console.log('✔ Restaurant-Service: escuchando eventos de reseñas');

    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Restaurant-Service corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar Restaurant-Service:', error);
    process.exit(1);
  }
};

startServer();
