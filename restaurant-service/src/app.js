const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const restaurantRoutes = require('./routes/restaurant.routes');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API - Restaurants',
      version: '1.0.0',
      description: 'Servicio público de catálogo de restaurantes',
    },
    servers: [
      { url: 'http://localhost:3003' } 
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/restaurants', restaurantRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

module.exports = app;