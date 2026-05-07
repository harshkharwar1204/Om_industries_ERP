const express = require('express');
const cors = require('cors');
const path = require('path');
const colorRoutes = require('./routes/colors.cjs');
const recipeRoutes = require('./routes/recipes.cjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/colors', colorRoutes);
app.use('/api/recipes', recipeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎨 Color Recipe Pro API running on port ${PORT}`);
});
