import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || '';
const PASSWORD_SALT_ROUNDS = Number(process.env.PASSWORD_SALT_ROUNDS || 10);


const locations = [
  { id: 'iit-main-gate', name: 'IIT Main Gate, Powai', lat: 19.1331, lng: 72.9152 },
  { id: 'powai-lake-gate', name: 'Powai Lake Gate', lat: 19.1176, lng: 72.9041 },
  { id: 'hiranandani-circle', name: 'Hiranandani Circle', lat: 19.1187, lng: 72.9116 },
  { id: 'bkc-metro', name: 'BKC Metro Station', lat: 19.0607, lng: 72.8688 },
  { id: 'kurla-terminus', name: 'Kurla Terminus', lat: 19.0714, lng: 72.8801 },
  { id: 'airport-t2', name: 'Mumbai Airport T2', lat: 19.0896, lng: 72.8656 },
  { id: 'andheri-station', name: 'Andheri Station', lat: 19.1197, lng: 72.8464 },
  { id: 'goregaon-hub', name: 'Goregaon Transport Hub', lat: 19.1649, lng: 72.8499 },
];

// Vehicle seeds are generated dynamically near the user's pickup location.
// Each offset (in degrees) keeps vehicles within ~0.8–2km of the pickup,
// so rides always appear regardless of where the user searches.
function generateVehicleSeeds(pickup) {
  return [
    {
      id: 'sh-4-a', label: 'RoadGo Share 4', type: '4-seater',
      lat: pickup.lat + 0.007, lng: pickup.lng + 0.003,
      occupiedSeats: [
        { seatId: 'B2', gender: 'male' },
        { seatId: 'B3', gender: 'female' },
      ],
    },
    {
      id: 'sh-4-b', label: 'RoadGo Share Plus', type: '4-seater',
      lat: pickup.lat - 0.009, lng: pickup.lng + 0.005,
      occupiedSeats: [{ seatId: 'B2', gender: 'female' }],
    },
    {
      id: 'sh-4-c', label: 'RoadGo Share Express', type: '4-seater',
      lat: pickup.lat + 0.004, lng: pickup.lng - 0.008,
      occupiedSeats: [], // fully empty — all seats free
    },
    {
      id: 'sh-4-d', label: 'RoadGo Share Standard', type: '4-seater',
      lat: pickup.lat - 0.014, lng: pickup.lng + 0.008,
      occupiedSeats: [
        { seatId: 'F1', gender: 'male' },
        { seatId: 'B1', gender: 'male' },
        { seatId: 'B3', gender: 'female' },
      ],
    },
    {
      id: 'sh-6-a', label: 'RoadGo Connect 6', type: '6-seater',
      lat: pickup.lat - 0.006, lng: pickup.lng - 0.006,
      occupiedSeats: [
        { seatId: 'M1', gender: 'male' },
        { seatId: 'M3', gender: 'male' },
        { seatId: 'B1', gender: 'female' },
      ],
    },
    {
      id: 'sh-6-b', label: 'RoadGo Connect Economy', type: '6-seater',
      lat: pickup.lat + 0.012, lng: pickup.lng - 0.002,
      occupiedSeats: [
        { seatId: 'M2', gender: 'female' },
        { seatId: 'B2', gender: 'female' },
      ],
    },
    {
      id: 'sh-6-c', label: 'RoadGo Connect Max', type: '6-seater',
      lat: pickup.lat + 0.002, lng: pickup.lng - 0.012,
      occupiedSeats: [{ seatId: 'F1', gender: 'male' }],
    },
    {
      id: 'sh-auto-a', label: 'RoadGo AutoShare', type: 'auto',
      lat: pickup.lat - 0.003, lng: pickup.lng + 0.010,
      occupiedSeats: [{ seatId: 'R1', gender: 'male' }],
    },
    {
      id: 'sh-auto-b', label: 'RoadGo AutoShare Plus', type: 'auto',
      lat: pickup.lat + 0.004, lng: pickup.lng + 0.007,
      occupiedSeats: [{ seatId: 'R2', gender: 'female' }],
    },
    {
      id: 'sh-auto-c', label: 'RoadGo AutoShare Max', type: 'auto',
      lat: pickup.lat - 0.011, lng: pickup.lng - 0.004,
      occupiedSeats: [], // empty auto
    },
  ];
}

const seatTemplates = {
  '4-seater': [
    { seatId: 'F1', label: 'F1', isWindow: true },
    { seatId: 'B1', label: 'B1', isWindow: true },
    { seatId: 'B2', label: 'B2', isWindow: false },
    { seatId: 'B3', label: 'B3', isWindow: true },
  ],
  '6-seater': [
    { seatId: 'F1', label: 'F1', isWindow: true },
    { seatId: 'M1', label: 'M1', isWindow: true },
    { seatId: 'M2', label: 'M2', isWindow: false },
    { seatId: 'M3', label: 'M3', isWindow: true },
    { seatId: 'B1', label: 'B1', isWindow: true },
    { seatId: 'B2', label: 'B2', isWindow: true },
  ],
  auto: [
    { seatId: 'F1', label: 'F1', isWindow: true },
    { seatId: 'R1', label: 'R1', isWindow: true },
    { seatId: 'R2', label: 'R2', isWindow: true },
  ],
};

const dummyDriverNames = [
  'Aarav Singh',
  'Ritika Sharma',
  'Kabir Patel',
  'Sneha Rao',
  'Vikram Mehta',
  'Nisha Khan',
  'Rohan Iyer',
  'Meera Nair',
];

const dummyVehicleColors = ['White', 'Silver', 'Blue', 'Grey', 'Black', 'Red'];
const policyHighlights = [
  'Live traffic-adjusted ETA',
  'Auto-reassign if driver delayed',
  'Refund = paid amount - cancellation fee',
  'Dummy fare range with peak multiplier',
];

const state = {
  dynamicLocationsById: new Map(),
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

let pool = null;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function now() {
  return new Date();
}

function parseDateTime(date, time) {
  if (!date || !time) {
    return null;
  }
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function isWithin20Days(requestedDate) {
  const current = now();
  const max = new Date(current);
  max.setDate(max.getDate() + 20);
  return requestedDate >= current && requestedDate <= max;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function hashToUnit(seed) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function pickFrom(seed, list) {
  const index = Math.floor(hashToUnit(seed) * list.length) % list.length;
  return list[index];
}

function formatVehicleNumber(seed) {
  const partA = String(Math.floor(hashToUnit(`${seed}-a`) * 90) + 10);
  const partB = String(Math.floor(hashToUnit(`${seed}-b`) * 9000) + 1000);
  return `MH 01 ${partA}${partB}`;
}

async function fetchGoogleRouteMetrics(pickup, drop, travelDateTime) {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const departureEpoch = Math.floor(travelDateTime.getTime() / 1000);
  const origin = `${pickup.lat},${pickup.lng}`;
  const destination = `${drop.lat},${drop.lng}`;
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}&mode=driving&departure_time=${departureEpoch}` +
    `&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  const leg = payload.routes?.[0]?.legs?.[0];
  if (!leg?.distance?.value || !leg?.duration?.value) {
    return null;
  }

  const distanceKm = Number(leg.distance.value) / 1000;
  const durationMin = Number(leg.duration.value) / 60;
  const trafficMin = Number(leg.duration_in_traffic?.value || leg.duration.value) / 60;
  return {
    distanceKm,
    durationMin,
    trafficMin,
    source: 'google-directions',
  };
}

async function resolveRouteMetrics(pickup, drop, travelDateTime) {
  try {
    const google = await fetchGoogleRouteMetrics(pickup, drop, travelDateTime);
    if (google) {
      return google;
    }
  } catch {
    // Ignore and fallback to haversine estimate.
  }

  const distanceKm = getDistanceKm(pickup.lat, pickup.lng, drop.lat, drop.lng);
  const durationMin = Math.max(10, Math.round(distanceKm * 3.8 + 8));
  return {
    distanceKm,
    durationMin,
    trafficMin: durationMin,
    source: 'fallback-haversine',
  };
}

function getAuthToken(req) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

async function connectDatabase() {
  if (!NEON_DATABASE_URL) {
    throw new Error('Missing NEON_DATABASE_URL. Set it before starting backend.');
  }

  pool = new Pool({
    connectionString: NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Attempt connecting and creating tables
    await pool.query('SELECT 1');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        phone VARCHAR(20) UNIQUE,
        gender VARCHAR(50),
        "passwordHash" text,
        "hasSubscription" boolean DEFAULT false,
        "creditBalance" numeric,
        "genderChangeRemaining" int DEFAULT 1,
        "createdAt" timestamp
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        "userPhone" VARCHAR(20),
        "createdAt" timestamp
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_userphone ON sessions("userPhone");
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        "bookingId" VARCHAR(255) PRIMARY KEY,
        "userPhone" VARCHAR(20),
        mode VARCHAR(50),
        "pickupName" text,
        "dropName" text,
        "travelDate" VARCHAR(50),
        "travelTime" VARCHAR(50),
        "carType" VARCHAR(50),
        "rideId" VARCHAR(255),
        "selectedSeatId" VARCHAR(50),
        "amountPaid" numeric,
        "paymentMethod" VARCHAR(100),
        "receiptCode" VARCHAR(100),
        "qrCodeText" text,
        status VARCHAR(50),
        "cancellationCharge" numeric,
        "createdAt" timestamp
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings("userPhone", "travelDate", "travelTime");
    `);

    console.log('Neon PostgreSQL connected and tables initialized.');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`PostgreSQL connection failed: ${reason}`);
  }
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

async function getUserFromRequest(req) {
  const token = getAuthToken(req);
  if (!token) {
    return null;
  }
  const db = getPool();
  const sessionRes = await db.query('SELECT * FROM sessions WHERE token = $1', [token]);
  if (sessionRes.rows.length === 0) {
    return null;
  }
  const session = sessionRes.rows[0];
  const userRes = await db.query('SELECT * FROM users WHERE phone = $1', [session.userPhone]);
  if (userRes.rows.length === 0) {
    return null;
  }
  const user = userRes.rows[0];
  user.creditBalance = Number(user.creditBalance); // Adjust from numeric string to number
  return { token, user };
}

function publicUser(user) {
  const creditBalance = typeof user.creditBalance === 'number' ? user.creditBalance : 0;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    gender: user.gender,
    hasSubscription: user.hasSubscription,
    canChangeGender: false,
    creditBalance,
  };
}

function findLocationById(id) {
  return state.dynamicLocationsById.get(id) || locations.find((location) => location.id === id);
}

async function fetchGoogleSuggestions(query) {
  if (!GOOGLE_MAPS_API_KEY || !query.trim()) {
    return [];
  }

  const input = encodeURIComponent(query);
  const autoUrl =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}` +
    `&components=country:in&language=en&key=${GOOGLE_MAPS_API_KEY}`;

  const autoResponse = await fetch(autoUrl);
  if (!autoResponse.ok) {
    return [];
  }
  const autoJson = await autoResponse.json();
  const predictions = Array.isArray(autoJson.predictions) ? autoJson.predictions.slice(0, 5) : [];

  const detailedLocations = await Promise.all(
    predictions.map(async (prediction) => {
      const placeId = prediction.place_id;
      if (!placeId) {
        return null;
      }
      const detailsUrl =
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
        `&fields=geometry/location,name,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        return null;
      }
      const detailsJson = await detailsResponse.json();
      const geometry = detailsJson.result?.geometry?.location;
      if (!geometry?.lat || !geometry?.lng) {
        return null;
      }
      return {
        id: `google-${placeId}`,
        name: detailsJson.result?.formatted_address || detailsJson.result?.name || prediction.description,
        lat: geometry.lat,
        lng: geometry.lng,
      };
    })
  );

  return detailedLocations.filter(Boolean);
}

function seatMapFor(seed) {
  const seats = (seatTemplates[seed.type] || []).map((seat) => {
    const occupied = seed.occupiedSeats.find((o) => o.seatId === seat.seatId);
    return {
      ...seat,
      occupied: Boolean(occupied),
      occupantGender: occupied ? occupied.gender : null,
    };
  });
  const occupiedCount = seats.filter((seat) => seat.occupied).length;
  return { seats, occupiedCount };
}

// Realistic Ola/Uber-style pricing: base + per-km + per-minute (traffic duration)
function calcBaseFare(mode, distanceKm, trafficMin, carType) {
  if (mode === 'solo') {
    const pricing = {
      auto:  { base: 25, perKm: 14.0, perMin: 1.50 },
      mini:  { base: 40, perKm: 13.0, perMin: 1.50 },
      sedan: { base: 60, perKm: 17.0, perMin: 2.00 },
      suv:   { base: 90, perKm: 22.0, perMin: 2.50 },
    };
    const p = pricing[carType] || pricing.mini;
    return Math.round(p.base + distanceKm * p.perKm + trafficMin * p.perMin);
  }

  // Sharing: ~45% of equivalent solo — riders split the cost
  const pricing = {
    '4-seater': { base: 18, perKm: 7.5, perMin: 0.90 },
    '6-seater': { base: 15, perKm: 6.5, perMin: 0.80 },
    auto:        { base: 12, perKm: 6.0, perMin: 0.70 },
  };
  const p = pricing[carType] || pricing['4-seater'];
  return Math.round(p.base + distanceKm * p.perKm + trafficMin * p.perMin);
}

function fareBreakdown(mode, distanceKm, trafficMin, carType, surgeFactor) {
  if (mode === 'solo') {
    const pricing = {
      auto:  { base: 25, perKm: 14.0, perMin: 1.50 },
      mini:  { base: 40, perKm: 13.0, perMin: 1.50 },
      sedan: { base: 60, perKm: 17.0, perMin: 2.00 },
      suv:   { base: 90, perKm: 22.0, perMin: 2.50 },
    };
    const p = pricing[carType] || pricing.mini;
    return {
      baseFare:    Math.round(p.base * surgeFactor),
      distCharge:  Math.round(distanceKm * p.perKm * surgeFactor),
      timeCharge:  Math.round(trafficMin  * p.perMin * surgeFactor),
      surgeFactor: Number(surgeFactor.toFixed(2)),
    };
  }
  const pricing = {
    '4-seater': { base: 18, perKm: 7.5, perMin: 0.90 },
    '6-seater': { base: 15, perKm: 6.5, perMin: 0.80 },
    auto:        { base: 12, perKm: 6.0, perMin: 0.70 },
  };
  const p = pricing[carType] || pricing['4-seater'];
  return {
    baseFare:    Math.round(p.base * surgeFactor),
    distCharge:  Math.round(distanceKm * p.perKm * surgeFactor),
    timeCharge:  Math.round(trafficMin  * p.perMin * surgeFactor),
    surgeFactor: Number(surgeFactor.toFixed(2)),
  };
}

function hourDemandFactor(date) {
  const hour = date.getHours();
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
    return 1.18;
  }
  if (hour >= 22 || hour <= 5) {
    return 1.08;
  }
  return 1;
}

function isoTimeWithOffset(baseDate, offsetMinutes) {
  const date = new Date(baseDate);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function buildSharedRides({ pickup, drop, travelDateTime, carType, sharingGender, routeMetrics }) {
  const routeDistance = routeMetrics.distanceKm;
  const trafficFactor = Math.max(1, routeMetrics.trafficMin / Math.max(1, routeMetrics.durationMin));
  const offsets = [-24, -12, -6, 0, 8, 16, 24];
  const matching = [];

  // Generate vehicles dynamically near this pickup — solves the 0-results bug
  const vehicleSeeds = generateVehicleSeeds(pickup);

  for (const seed of vehicleSeeds) {
    if (carType && seed.type !== carType) {
      continue;
    }

    const distanceToPickup = getDistanceKm(pickup.lat, pickup.lng, seed.lat, seed.lng);
    if (distanceToPickup > 3) {
      continue;
    }

    for (const offset of offsets) {
      const slotTime = isoTimeWithOffset(travelDateTime, offset);
      const distanceMins = Math.abs(slotTime.getTime() - travelDateTime.getTime()) / (1000 * 60);
      if (distanceMins > 45) {
        continue;
      }

      const seatMap = seatMapFor(seed);
      const available = seatMap.seats.length - seatMap.occupiedCount;
      if (available <= 0) {
        continue;
      }

      const maleOnboard = seed.occupiedSeats.filter((seat) => seat.gender === 'male').length;
      const femaleOnboard = seed.occupiedSeats.filter((seat) => seat.gender === 'female').length;
      let genderFitScore = 1;
      if (sharingGender === 'female') {
        genderFitScore = maleOnboard === 0 ? 3 : maleOnboard === 1 ? 2 : 1;
      } else if (sharingGender === 'male') {
        genderFitScore = femaleOnboard > 0 ? 2 : 1;
      } else {
        const balance = Math.abs(maleOnboard - femaleOnboard);
        genderFitScore = balance === 0 ? 3 : balance === 1 ? 2 : 1;
      }

      const occupancyRate = seatMap.occupiedCount / seatMap.seats.length;
      const surgeFactor = hourDemandFactor(slotTime) + occupancyRate * 0.16 + (trafficFactor - 1) * 0.24;
      const jitter = 0.92 + hashToUnit(`${seed.id}-${formatTime(slotTime)}`) * 0.2;
      const rawFare = calcBaseFare('sharing', routeDistance, routeMetrics.trafficMin, seed.type);
      const fare = Math.max(35, Math.round(rawFare * surgeFactor * jitter));
      // Pickup ETA: haversine distance from driver to pickup at ~18 km/h city speed
      const pickupEta = Math.max(4, Math.round((distanceToPickup / 18) * 60 + 2));
      const inRideMinutes = Math.round(routeMetrics.trafficMin + hashToUnit(seed.id) * 4);
      const totalTravelMinutes = pickupEta + inRideMinutes;
      const dropEstimate = new Date(slotTime);
      dropEstimate.setMinutes(dropEstimate.getMinutes() + inRideMinutes);
      const rideSeed = `${seed.id}-${formatTime(slotTime)}`;
      const breakdown = fareBreakdown('sharing', routeDistance, routeMetrics.trafficMin, seed.type, surgeFactor * jitter);

      matching.push({
        rideId: rideSeed,
        provider: seed.label,
        mode: 'sharing',
        carType: seed.type,
        seatsTotal: seatMap.seats.length,
        seatsAvailable: available,
        occupancyScore: seatMap.occupiedCount / seatMap.seats.length,
        distanceFromPickupKm: Number(distanceToPickup.toFixed(2)),
        departureTime: formatTime(slotTime),
        etaMinutes: pickupEta,
        totalTravelMinutes,
        baseFare: fare,
        fareBreakdown: breakdown,
        routeInfo: {
          distanceKm: Number(routeDistance.toFixed(2)),
          durationMin: Math.round(routeMetrics.durationMin),
          trafficMin:  Math.round(routeMetrics.trafficMin),
          source: routeMetrics.source,
        },
        seatMap: seatMap.seats,
        maleOnboard,
        femaleOnboard,
        genderFitScore,
        driverName: pickFrom(`${rideSeed}-driver`, dummyDriverNames),
        driverRating: Number((4.1 + hashToUnit(`${rideSeed}-rating`) * 0.8).toFixed(1)),
        vehicleNumber: formatVehicleNumber(rideSeed),
        vehicleColor: pickFrom(`${rideSeed}-color`, dummyVehicleColors),
        estimatedDropTime: formatTime(dropEstimate),
        pricingTag: trafficFactor > 1.2 ? '🔴 Peak traffic surge' : surgeFactor > 1.1 ? '🟡 Mild surge' : '🟢 Standard fare',
        poolingMatchPercent: 58 + Math.round(hashToUnit(`${rideSeed}-pool`) * 38),
        policyHint: pickFrom(`${rideSeed}-policy`, policyHighlights),
      });
    }
  }

  matching.sort((a, b) => {
    if (a.genderFitScore !== b.genderFitScore) {
      return b.genderFitScore - a.genderFitScore;
    }
    if (a.distanceFromPickupKm !== b.distanceFromPickupKm) {
      return a.distanceFromPickupKm - b.distanceFromPickupKm;
    }
    if (a.occupancyScore !== b.occupancyScore) {
      return b.occupancyScore - a.occupancyScore;
    }
    return a.departureTime.localeCompare(b.departureTime);
  });

  return matching.slice(0, 12);
}

function buildSoloRides({ pickup, drop, travelDateTime, carType, routeMetrics }) {
  const routeDistance = routeMetrics.distanceKm;
  const trafficFactor = Math.max(1, routeMetrics.trafficMin / Math.max(1, routeMetrics.durationMin));
  const allTypes = ['auto', 'mini', 'sedan', 'suv'];
  const types = allTypes.includes(carType) ? [carType] : allTypes;

  // Realistic Mumbai minimums (Ola/Uber parity)
  const minimumByType = {
    auto:  50,
    mini:  80,
    sedan: 120,
    suv:   180,
  };

  // Nearby driver distances — slightly different per type to feel realistic
  const driverProximityKm = {
    auto:  0.4 + Math.random() * 0.6,
    mini:  0.5 + Math.random() * 0.8,
    sedan: 0.7 + Math.random() * 1.0,
    suv:   1.0 + Math.random() * 1.2,
  };

  return types.map((type, index) => {
    const typeSeed   = `${type}-${travelDateTime.toISOString()}`;
    const surgeFactor = hourDemandFactor(travelDateTime) + (trafficFactor - 1) * 0.35 + hashToUnit(`${typeSeed}-surge`) * 0.08;
    const minimumFare = minimumByType[type] || 80;
    const rawFare     = calcBaseFare('solo', routeDistance, routeMetrics.trafficMin, type);
    const baseFare    = Math.max(minimumFare, Math.round(rawFare * surgeFactor));
    const driverKm    = driverProximityKm[type] || 0.8;
    // ETA = driver travels to pickup at ~22 km/h average city speed
    const pickupEta   = Math.max(2, Math.round((driverKm / 22) * 60 + 1));
    const inRideMinutes    = Math.round(routeMetrics.trafficMin);
    const totalTravelMinutes = pickupEta + inRideMinutes;
    const dropEstimate  = new Date(travelDateTime);
    dropEstimate.setMinutes(dropEstimate.getMinutes() + inRideMinutes);
    const breakdown = fareBreakdown('solo', routeDistance, routeMetrics.trafficMin, type, surgeFactor);

    return {
      rideId: `solo-${type}`,
      provider: `RoadGo ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      mode: 'solo',
      carType: type,
      etaMinutes: pickupEta,
      totalTravelMinutes,
      baseFare,
      fareBreakdown: breakdown,
      routeInfo: {
        distanceKm: Number(routeDistance.toFixed(2)),
        durationMin: Math.round(routeMetrics.durationMin),
        trafficMin:  Math.round(routeMetrics.trafficMin),
        source: routeMetrics.source,
      },
      seatsTotal: type === 'auto' ? 3 : 4,
      seatsAvailable: type === 'auto' ? 2 : 3,
      distanceFromPickupKm: Number(driverKm.toFixed(2)),
      departureTime: formatTime(travelDateTime),
      seatMap: null,
      driverName: pickFrom(`${typeSeed}-driver`, dummyDriverNames),
      driverRating: Number((4.2 + hashToUnit(`${typeSeed}-rating`) * 0.7).toFixed(1)),
      vehicleNumber: formatVehicleNumber(typeSeed),
      vehicleColor: pickFrom(`${typeSeed}-color`, dummyVehicleColors),
      estimatedDropTime: formatTime(dropEstimate),
      pricingTag: trafficFactor > 1.2 ? '🔴 Peak traffic surge' : surgeFactor > 1.12 ? '🟡 Mild surge' : '🟢 Standard fare',
      policyHint: pickFrom(`${typeSeed}-policy`, policyHighlights),
    };
  });
}

function bookingToSummary(booking) {
  return {
    bookingId: booking.bookingId,
    mode: booking.mode,
    pickupName: booking.pickupName,
    dropName: booking.dropName,
    travelDate: booking.travelDate,
    travelTime: booking.travelTime,
    carType: booking.carType,
    selectedSeatId: booking.selectedSeatId,
    amountPaid: booking.amountPaid,
    status: booking.status,
    createdAt: booking.createdAt,
    qrCodeText: booking.qrCodeText,
    receiptCode: booking.receiptCode,
    cancellationCharge: booking.cancellationCharge,
  };
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'roadgo-backend' });
      return;
    }

    if (req.method === 'POST' && pathname === '/auth/signup') {
      const db = getPool();
      const body = await parseJson(req);
      const name = String(body.name || '').trim();
      const phone = sanitizePhone(body.phone);
      const gender = String(body.gender || '').toLowerCase();
      const password = String(body.password || '');

      if (!name || phone.length !== 10 || !['male', 'female', 'other'].includes(gender)) {
        sendJson(res, 400, { error: 'Enter valid name, 10-digit phone number and gender.' });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
        return;
      }

      const existingRes = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
      if (existingRes.rows.length > 0) {
        sendJson(res, 409, { error: 'Account already exists for this phone number. Please login.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      const user = {
        id: randomUUID(),
        name,
        phone,
        gender,
        passwordHash,
        hasSubscription: false,
        creditBalance: 50,
        genderChangeRemaining: 1,
        createdAt: now().toISOString(),
      };

      await db.query(
        'INSERT INTO users (id, name, phone, gender, "passwordHash", "hasSubscription", "creditBalance", "genderChangeRemaining", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [user.id, user.name, user.phone, user.gender, user.passwordHash, user.hasSubscription, user.creditBalance, user.genderChangeRemaining, user.createdAt]
      );
      const token = randomUUID();
      await db.query(
        'INSERT INTO sessions (token, "userPhone", "createdAt") VALUES ($1, $2, $3)',
        [token, phone, now().toISOString()]
      );

      sendJson(res, 201, {
        message: 'Signup successful.',
        token,
        user: publicUser(user),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/auth/login') {
      const db = getPool();
      const body = await parseJson(req);
      const phone = sanitizePhone(body.phone);
      const password = String(body.password || '');

      if (phone.length !== 10 || !password) {
        sendJson(res, 400, { error: 'Enter valid 10-digit phone number and password.' });
        return;
      }

      const userRes = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
      if (userRes.rows.length === 0) {
        sendJson(res, 404, { error: 'No account exists for this phone number. Please signup first.' });
        return;
      }
      const user = userRes.rows[0];
      user.creditBalance = Number(user.creditBalance); // Adjust numeric

      const passwordOk = Boolean(user.passwordHash) && (await bcrypt.compare(password, user.passwordHash));
      if (!passwordOk) {
        sendJson(res, 401, { error: 'Incorrect password.' });
        return;
      }

      const token = randomUUID();
      await db.query(
        'INSERT INTO sessions (token, "userPhone", "createdAt") VALUES ($1, $2, $3)',
        [token, phone, now().toISOString()]
      );

      sendJson(res, 200, {
        token,
        user: publicUser(user),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/auth/logout') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const db = getPool();
      await db.query('DELETE FROM sessions WHERE token = $1', [auth.token]);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/auth/me') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      sendJson(res, 200, { user: publicUser(auth.user) });
      return;
    }

    if (req.method === 'POST' && pathname === '/subscription/toggle') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const db = getPool();
      const body = await parseJson(req);
      const enabled = Boolean(body.enabled);
      await db.query('UPDATE users SET "hasSubscription" = $1 WHERE phone = $2', [enabled, auth.user.phone]);
      auth.user.hasSubscription = enabled;
      sendJson(res, 200, { user: publicUser(auth.user) });
      return;
    }

    if (req.method === 'POST' && pathname === '/profile/update-gender') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      sendJson(res, 403, {
        error: 'Gender cannot be changed after signup due to privacy policy.',
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/locations/suggest') {
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      if (!q) {
        sendJson(res, 200, { locations: locations.slice(0, 6) });
        return;
      }
      const localResult = locations
        .filter((location) => location.name.toLowerCase().includes(q))
        .slice(0, 8);
      const googleResult = await fetchGoogleSuggestions(q);

      const merged = [...googleResult, ...localResult]
        .filter((location, index, array) => array.findIndex((item) => item.id === location.id) === index)
        .slice(0, 8);

      merged.forEach((location) => {
        state.dynamicLocationsById.set(location.id, location);
      });

      sendJson(res, 200, { locations: merged });
      return;
    }

    if (req.method === 'POST' && pathname === '/rides/search') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await parseJson(req);
      const pickup = findLocationById(body.pickupId);
      const drop = findLocationById(body.dropId);
      const travelDateTime = parseDateTime(body.travelDate, body.travelTime);
      const mode = String(body.mode || 'sharing');
      const carType = String(body.carType || '').toLowerCase();
      const sharingGender = String(body.sharingGender || '').toLowerCase();

      if (!pickup || !drop) {
        sendJson(res, 400, { error: 'Invalid pickup/drop location.' });
        return;
      }

      if (!travelDateTime || !isWithin20Days(travelDateTime)) {
        sendJson(res, 400, { error: 'Travel date/time must be within the next 20 days.' });
        return;
      }

      if (!['sharing', 'solo'].includes(mode)) {
        sendJson(res, 400, { error: 'Mode must be sharing or solo.' });
        return;
      }

      const routeMetrics = await resolveRouteMetrics(pickup, drop, travelDateTime);
      const rides =
        mode === 'sharing'
          ? buildSharedRides({
              pickup,
              drop,
              travelDateTime,
              carType,
              sharingGender,
              routeMetrics,
            })
          : buildSoloRides({ pickup, drop, travelDateTime, carType, routeMetrics });

      sendJson(res, 200, {
        rides,
        constraints: {
          maxAdvanceDays: 20,
          sharingRadiusKm: 3,
          searchOptimizedForSeatFill: mode === 'sharing',
          routeSource: routeMetrics.source,
        },
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/bookings/confirm-payment') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const db = getPool();

      const body = await parseJson(req);
      const pickup = findLocationById(body.pickupId);
      const drop = findLocationById(body.dropId);
      const travelDate = String(body.travelDate || '');
      const travelTime = String(body.travelTime || '');
      const mode = String(body.mode || 'sharing');
      const carType = String(body.carType || '').toLowerCase();
      const selectedSeatId = body.selectedSeatId ? String(body.selectedSeatId) : null;
      const rideId = String(body.rideId || '');
      const quotedFare = Number(body.quotedFare);
      const paymentMethod = String(body.paymentMethod || 'Dummy Payment');

      if (!pickup || !drop || !travelDate || !travelTime || !rideId) {
        sendJson(res, 400, { error: 'Missing booking details.' });
        return;
      }

      const routeDistance = getDistanceKm(pickup.lat, pickup.lng, drop.lat, drop.lng);
      const baseFare =
        Number.isFinite(quotedFare) && quotedFare > 0
          ? Math.round(quotedFare)
          : calcBaseFare(mode, routeDistance, carType || '4-seater');

      let windowSeatCharge = 0;
      if (mode === 'sharing' && selectedSeatId) {
        const template = seatTemplates[carType] || [];
        const seat = template.find((s) => s.seatId === selectedSeatId);
        if (seat?.isWindow && !auth.user.hasSubscription) {
          windowSeatCharge = 20;
        }
      }

      const amountPaid = baseFare + windowSeatCharge;
      const bookingId = `RG-${Date.now()}-${randomInt(10, 99)}`;
      const receiptCode = `RCP-${randomInt(100000, 999999)}`;
      const qrCodeText = [bookingId, auth.user.phone, travelDate, travelTime, String(amountPaid)].join('|');

      const booking = {
        bookingId,
        userPhone: auth.user.phone,
        mode,
        pickupName: pickup.name,
        dropName: drop.name,
        travelDate,
        travelTime,
        carType,
        rideId,
        selectedSeatId,
        amountPaid,
        paymentMethod,
        receiptCode,
        qrCodeText,
        status: 'CONFIRMED',
        createdAt: now().toISOString(),
        cancellationCharge: 0,
      };

      await db.query(
        'INSERT INTO bookings ("bookingId", "userPhone", mode, "pickupName", "dropName", "travelDate", "travelTime", "carType", "rideId", "selectedSeatId", "amountPaid", "paymentMethod", "receiptCode", "qrCodeText", status, "cancellationCharge", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)',
        [booking.bookingId, booking.userPhone, booking.mode, booking.pickupName, booking.dropName, booking.travelDate, booking.travelTime, booking.carType, booking.rideId, booking.selectedSeatId, booking.amountPaid, booking.paymentMethod, booking.receiptCode, booking.qrCodeText, booking.status, booking.cancellationCharge, booking.createdAt]
      );

      sendJson(res, 200, {
        paymentStatus: 'SUCCESS',
        booking: bookingToSummary(booking),
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/bookings') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const db = getPool();

      const segment = String(url.searchParams.get('segment') || 'all');
      const current = now();
      const bookingsRes = await db.query('SELECT * FROM bookings WHERE "userPhone" = $1', [auth.user.phone]);
      const allUserBookings = bookingsRes.rows;

      const filtered = allUserBookings
        .map((booking) => {
          const dateTime = parseDateTime(booking.travelDate, booking.travelTime);
          return {
            ...booking,
            dateTime: dateTime ? dateTime.getTime() : 0,
          };
        })
        .filter((booking) => {
          if (segment === 'upcoming') {
            return booking.dateTime >= current.getTime();
          }
          if (segment === 'history') {
            return booking.dateTime < current.getTime();
          }
          return true;
        })
        .sort((a, b) => b.dateTime - a.dateTime)
        .map(bookingToSummary);

      sendJson(res, 200, { bookings: filtered });
      return;
    }

    if (req.method === 'GET' && pathname === '/cancellation-policy') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      sendJson(res, 200, {
        policy: {
          subscriber: {
            summary: 'Free cancellation with full refund.',
            lateFee: 0,
          },
          nonSubscriber: {
            summary: 'Refund = total paid - cancellation fee (Rs 59 standard, Rs 99 within 60 minutes).',
            standardFee: 59,
            lateFee: 99,
          },
          note: 'Refund is processed as total paid minus cancellation fee.',
          creditPenaltyPerCancellation: 0,
        },
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/bookings/cancel') {
      const auth = await getUserFromRequest(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const db = getPool();

      const body = await parseJson(req);
      const bookingId = String(body.bookingId || '');
      const bookingRes = await db.query('SELECT * FROM bookings WHERE "bookingId" = $1 AND "userPhone" = $2', [bookingId, auth.user.phone]);
      const booking = bookingRes.rows.length > 0 ? bookingRes.rows[0] : null;

      if (!booking) {
        sendJson(res, 404, { error: 'Booking not found.' });
        return;
      }
      if (booking.status === 'CANCELLED') {
        sendJson(res, 400, { error: 'Booking already cancelled.' });
        return;
      }

      const bookingDateTime = parseDateTime(booking.travelDate, booking.travelTime);
      const minsToTravel = bookingDateTime ? Math.round((bookingDateTime.getTime() - Date.now()) / 60000) : 120;

      let charge = 0;
      if (!auth.user.hasSubscription) {
        charge = minsToTravel <= 60 ? 99 : 59;
      }
      const currentCredits = typeof auth.user.creditBalance === 'number' ? auth.user.creditBalance : 0;
      const nextCredits = currentCredits;
      const amountPaid = typeof booking.amountPaid === 'number' ? booking.amountPaid : 0;
      const refundAmount = Math.max(0, amountPaid - charge);

      await db.query('UPDATE bookings SET status = $1, "cancellationCharge" = $2 WHERE "bookingId" = $3', ['CANCELLED', charge, bookingId]);
      await db.query('UPDATE users SET "creditBalance" = $1 WHERE phone = $2', [nextCredits, auth.user.phone]);
      auth.user.creditBalance = nextCredits;

      const updated = {
        ...booking,
        status: 'CANCELLED',
        cancellationCharge: charge,
      };

      sendJson(res, 200, {
        message: 'Booking cancelled.',
        cancellationCharge: charge,
        creditPenalty: 0,
        refundAmount,
        amountPaid,
        creditBalance: nextCredits,
        user: publicUser(auth.user),
        booking: bookingToSummary(updated),
      });
      return;
    }

    sendJson(res, 404, { error: `No route found for ${req.method} ${pathname}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    sendJson(res, 500, { error: message });
  }
});

async function start() {
  await connectDatabase();
  server.listen(PORT, HOST, () => {
    console.log(`RoadGo backend running on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error(`Failed to start RoadGo backend: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

async function shutdown(signal) {
  try {
    console.log(`Shutting down RoadGo backend (${signal})`);
    if (pool) {
      await pool.end();
    }
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
