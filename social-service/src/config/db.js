const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ MongoDB conectado en Social-Service');
};

module.exports = connectDB;
