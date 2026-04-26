const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3006;
    app.listen(PORT, () => {
      console.log(`Social-Service corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar Social-Service:', error);
    process.exit(1);
  }
};

startServer();
