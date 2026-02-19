const express = require("express");
const userRoutes = require("./Routes/Tharusha/UserRoutes");
const vaccineRoutes  = require('./Routes/Dillon/VaccineRoutes');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/users", userRoutes);
app.use('/api/vaccines', vaccineRoutes);

module.exports = app;