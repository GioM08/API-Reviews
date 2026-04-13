const dotenv = require("dotenv");
const express = require('express');
const cors = require('cors');

const userRoutes = require("./routes/user.routes.js");

dotenv.config();

const app = express();
app.use(cors());


app.use(express.json());


app.use("/api/users", userRoutes);


module.exports = app;