const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ MongoDB conectado en Notification-Service');
};

module.exports = connectDB;
