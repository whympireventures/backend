const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Explicitly allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://locatemycitywebmain-fwaofqejd-jared-whyms-projects.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // ✅ Allow localhost dev
    if (origin.startsWith("http://localhost:3000")) {
      return callback(null, true);
    }

    // ✅ Allow any Vercel preview/prod deployment like
    // https://locate-my-city-blue.vercel.app or https://locate-my-city.vercel.app
    if (/^https:\/\/locate-my-city.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // ✅ Explicit whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ❌ Block anything else
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));

// Load data at startup
let rockCities = [];
let springCities = [];

// ⭐ ADDED — NEW dataset for OLD cities
let oldCities = {}; // ⭐ ADDED


function flattenStateGroupedData(data) {
  return Object.keys(data).flatMap(state =>
    data[state].map(item => ({ ...item, state }))
  );
}

try {
  rockCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'rock_cities.json'), 'utf8'));
} catch (error) {
  console.error('Error loading rock_cities.json:', error.message);
  rockCities = [];
}

try {
  springCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'spring_cities.json'), 'utf8'));
} catch (error) {
  console.error('Error loading spring_cities.json:', error.message);
  springCities = {};
}

// ⭐ ADDED — load old_cities.json
try {
  oldCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'old_cities.json'), 'utf8')); // ⭐ ADDED
} catch (error) {
  console.error('Error loading old_cities.json:', error.message); // ⭐ ADDED
  oldCities = {}; // ⭐ ADDED
}


// Routes
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

// ⭐ ADDED — OLD cities endpoints
app.get('/api/olds', (req, res) => {          // ⭐ ADDED
  res.json(oldCities);                        // ⭐ ADDED
});                                           // ⭐ ADDED

app.get('/api/olds/flat', (req, res) => {     // ⭐ ADDED
  res.json(flattenStateGroupedData(oldCities)); // ⭐ ADDED
});                                           // ⭐ ADDED

app.get('/api/olds/states', (req, res) => {   // ⭐ ADDED
  res.json(Object.keys(oldCities).sort());    // ⭐ ADDED
});                                           // ⭐ ADDED

app.get('/api/olds/:state', (req, res) => {   // ⭐ ADDED
  res.json(oldCities[req.params.state] || []); // ⭐ ADDED
});                                           // ⭐ ADDED


app.get('/api/stats', (req, res) => {
  const flatSprings = flattenStateGroupedData(springCities);

  // ⭐ ADDED — flatten Old Cities for stats
  const flatOlds = flattenStateGroupedData(oldCities); // ⭐ ADDED

  res.json({
    rockCities: {
      total: rockCities.length,
      states: [...new Set(rockCities.map(item => item.state))].length
    },
    springCities: {
      total: flatSprings.length,
      states: Object.keys(springCities).length
    },
    // ⭐ ADDED — include OLD cities stats
    oldCities: {                                    // ⭐ ADDED
      total: flatOlds.length,                       // ⭐ ADDED
      states: Object.keys(oldCities).length         // ⭐ ADDED
    }
  });
});

// Simple test route
app.get('/ping', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
