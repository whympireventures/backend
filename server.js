// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

/* -------------------- CORS -------------------- */
// Allow your Vercel frontend in production, localhost in dev
const allowedOrigins = [
  'http://localhost:3000',
  'https://locatemycitywebmain.vercel.app',
];

app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin / server-to-server (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

/* -------------------- Helpers -------------------- */
const readJSON = (file, fallback) => {
  try {
    const full = path.join(__dirname, file);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
    return fallback;
  }
};

const toRad = (d) => (d * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
const kmToMiles = (km) => km * 0.621371;

/* -------------------- Load data at startup -------------------- */
// Existing datasets you already serve
let rockCities = readJSON('rock_cities.json', []);
let springCities = readJSON('spring_cities.json', {});

// NEW: Cities 15k dataset (array)
// Expected shape (example):
// [{ "name":"Anaheim","lat":33.8353,"lon":-117.9145,"country":"United States","admin1":"California" }, ...]
let cities = readJSON('cities.json', []);

/* -------------------- Transformers -------------------- */
function flattenStateGroupedData(data) {
  return Object.keys(data).flatMap((state) =>
    (data[state] || []).map((item) => ({ ...item, state }))
  );
}

/* -------------------- Existing routes (unchanged) -------------------- */
// Rock cities
app.get('/api/locations', (req, res) => {
  res.json(rockCities);
});

app.get('/api/states', (req, res) => {
  const states = [...new Set(rockCities.map((item) => item.state))].sort();
  res.json(states);
});

app.get('/api/locations/:state', (req, res) => {
  const stateLocations = rockCities.filter(
    (item) => item.state === req.params.state
  );
  res.json(stateLocations);
});

// Springs
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

app.get('/api/stats', (req, res) => {
  const flatSprings = flattenStateGroupedData(springCities);
  res.json({
    rockCities: {
      total: rockCities.length,
      states: [...new Set(rockCities.map((item) => item.state))].length,
    },
    springCities: {
      total: flatSprings.length,
      states: Object.keys(springCities).length,
    },
    cities: {
      total: cities.length,
      countries: [...new Set(cities.map((c) => c.country))].length,
    },
  });
});

/* -------------------- NEW: cities.json API -------------------- */

// 1) Raw dump
app.get('/api/cities', (req, res) => {
  res.json(cities);
});

// 2) Find cities by name (case-insensitive)
//    /api/cities/by-name?name=anaheim&admin1=california&country=united%20states
app.get('/api/cities/by-name', (req, res) => {
  const { name = '', admin1 = '', country = '' } = req.query;
  const n = name.toLowerCase().trim();
  const a = admin1.toLowerCase().trim();
  const c = country.toLowerCase().trim();

  const matches = cities.filter((city) => {
    const okName = n ? city.name.toLowerCase().includes(n) : true;
    const okAdmin = a ? (city.admin1 || '').toLowerCase().includes(a) : true;
    const okCountry = c ? city.country.toLowerCase().includes(c) : true;
    return okName && okAdmin && okCountry;
  });

  res.json(matches);
});

// 3) Cities within a radius (miles)
//    /api/cities/near?lat=33.8353&lon=-117.9145&radiusMiles=25
app.get('/api/cities/near', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radiusMiles = parseFloat(req.query.radiusMiles || '25');

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res
      .status(400)
      .json({ error: 'lat and lon are required (numbers)' });
  }

  const out = cities
    .map((city) => {
      const km = haversineKm(lat, lon, city.lat, city.lon);
      const miles = kmToMiles(km);
      return { ...city, distanceMiles: miles };
    })
    .filter((c) => c.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  res.json(out);
});

// 4) Cities at an "exact" distance band (±epsilon miles)
//    /api/cities/exact?lat=33.8353&lon=-117.9145&miles=50&epsilon=1
app.get('/api/cities/exact', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const milesTarget = parseFloat(req.query.miles);
  const epsilon = parseFloat(req.query.epsilon || '1'); // default ±1 mile

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(milesTarget)
  ) {
    return res.status(400).json({
      error: 'lat, lon, and miles are required (numbers)',
    });
  }

  const min = Math.max(0, milesTarget - epsilon);
  const max = milesTarget + epsilon;

  const out = cities
    .map((city) => {
      const km = haversineKm(lat, lon, city.lat, city.lon);
      const miles = kmToMiles(km);
      return { ...city, distanceMiles: miles };
    })
    .filter((c) => c.distanceMiles >= min && c.distanceMiles <= max)
    .sort((a, b) => Math.abs(a.distanceMiles - milesTarget) - Math.abs(b.distanceMiles - milesTarget));

  res.json({
    targetMiles: milesTarget,
    epsilon,
    results: out,
  });
});

/* -------------------- Health -------------------- */
app.get('/ping', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

/* -------------------- Start server -------------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
