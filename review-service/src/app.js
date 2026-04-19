const express = require('express');
const cors = require('cors');
const reviewRoutes = require('./routes/review.routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/reviews', reviewRoutes);

module.exports = app;
