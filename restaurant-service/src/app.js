const express = require('express');
const cors = require('cors');
const restaurantRoutes = require('./routes/restaurant.routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/restaurants', restaurantRoutes);

module.exports = app;
