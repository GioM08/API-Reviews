const express = require('express');
const cors = require('cors');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/notifications', notificationRoutes);

module.exports = app;
