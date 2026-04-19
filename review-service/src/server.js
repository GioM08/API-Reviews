const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { createTables } = require('./models/review.model');
const { consumeRestaurantCreated } = require('./utils/consumer');

const startServer = async () => {
  try {
    await connectDB();
    await createTables();

    await consumeRestaurantCreated();
    console.log('✔ Review-Service: escuchando eventos de restaurantes');

    const PORT = process.env.PORT || 3004;
    app.listen(PORT, () => {
      console.log(`Review-Service corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar Review-Service:', error);
    process.exit(1);
  }
};

startServer();
