const dotenv = require("dotenv");
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const userRoutes = require("./routes/user.routes.js");

dotenv.config();

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API - Users',
      version: '1.0.0',
      description: 'Servicio de gestión de perfiles de usuario',
    },
    servers: [
      { url: 'http://localhost:3001' } 
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
app.disable('x-powered-by');
app.use(cors());

app.use(express.json());

app.use("/api/users", userRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

module.exports = app;