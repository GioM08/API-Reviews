const express = require('express');
const cors = require('cors');

const friendshipRoutes = require('./routes/friendship.routes');
const planRoutes = require('./routes/plan.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/friends', friendshipRoutes);
app.use('/api/plans', planRoutes);

module.exports = app;
