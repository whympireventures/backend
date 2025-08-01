const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Allowed frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://locatemycity.com',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Util to flatten state-grouped JSON
function flattenStateGroupedData(data) {
  return Object.keys(data).flatMap(state =>
    data[state].map(item => ({ ...item, state }))
  );
}

// Load datasets
let rockCities = [];
let springCities = {};
let colorCities = {};

try {
  rockCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'rock_cities.json'), 'utf8'));
} catch (error) {
  console.error('Error loading rock_cities.json:', error.message);
}

try {
  springCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'spring_cities.json'), 'utf8'));
} catch (error) {
  console.error('Error loading spring_cities.json:', error.message);
}

try {
  colorCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'color-cities.json'), 'utf8'));
} catch (error) {
  console.error('Error loading color-cities.json:', error.message);
}

// ROUTES

// ROCK
app.get('/api/locations', (req, res) => {
  res.json(rockCities);
});

app.get('/api/states', (req, res) => {
  const states = [...new Set(rockCities.map(item => item.state))].sort();
  res.json(states);
});

app.get('/api/locations/:state', (req, res) => {
  const stateLocations = rockCities.filter(item => item.state === req.params.state);
  res.json(stateLocations);
});

// SPRINGS
app.get('/api/springs', (req, res) => {
  res.json(springCities);
});

app.get('/api/springs/flat', (req, res) => {
  res.json(flattenStateGroupedData(springCities));
});

app.get('/api/springs/states', (req, res) => {
  res.json(Object.keys(springCities).sort());
});

app.get('/api/springs/:state', (req, res) => {
  res.json(springCities[req.params.state] || []);
});

// COLORS ✅ NEW
app.get('/api/colors', (req, res) => {
  res.json(colorCities);
});

app.get('/api/colors/flat', (req, res) => {
  res.json(flattenStateGroupedData(colorCities));
});

app.get('/api/colors/states', (req, res) => {
  res.json(Object.keys(colorCities).sort());
});

app.get('/api/colors/:state', (req, res) => {
  res.json(colorCities[req.params.state] || []);
});

// COMBINED STATS
app.get('/api/stats', (req, res) => {
  const flatSprings = flattenStateGroupedData(springCities);
  const flatColors = flattenStateGroupedData(colorCities);

  res.json({
    rockCities: {
      total: rockCities.length,
      states: [...new Set(rockCities.map(item => item.state))].length
    },
    springCities: {
      total: flatSprings.length,
      states: Object.keys(springCities).length
    },
    colorCities: {
      total: flatColors.length,
      states: Object.keys(colorCities).length
    }
  });
});

// Health check
app.get('/ping', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
