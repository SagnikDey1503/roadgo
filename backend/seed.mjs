import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../package.json'));
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Locations (same as server) ──────────────────────────────────────────────
const locations = [
  { name: 'IIT Main Gate, Powai' },
  { name: 'Powai Lake Gate' },
  { name: 'Hiranandani Circle' },
  { name: 'BKC Metro Station' },
  { name: 'Kurla Terminus' },
  { name: 'Mumbai Airport T2' },
  { name: 'Andheri Station' },
  { name: 'Goregaon Transport Hub' },
  { name: 'Bandra Kurla Complex' },
  { name: 'Dadar Station West' },
  { name: 'Thane Railway Station' },
  { name: 'Navi Mumbai APMC' },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickTwo(arr) {
  const a = Math.floor(Math.random() * arr.length);
  let b = Math.floor(Math.random() * arr.length);
  while (b === a) b = Math.floor(Math.random() * arr.length);
  return [arr[a], arr[b]];
}
function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function randomTime() {
  const h = String(Math.floor(Math.random() * 16) + 6).padStart(2, '0');
  const m = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)];
  return `${h}:${m}`;
}
function randomFare(mode, carType) {
  if (mode === 'solo') {
    const base = { auto: 90, mini: 150, sedan: 210, suv: 290 };
    return base[carType] + Math.floor(Math.random() * 120);
  }
  return 35 + Math.floor(Math.random() * 80);
}

// ── Dummy Users ──────────────────────────────────────────────────────────────
const USERS = [
  { name: 'Aarav Mehta',    phone: '9876543210', gender: 'male',   hasSubscription: true,  creditBalance: 150 },
  { name: 'Priya Sharma',   phone: '9812345678', gender: 'female', hasSubscription: false, creditBalance: 50  },
  { name: 'Rohan Iyer',     phone: '9988776655', gender: 'male',   hasSubscription: true,  creditBalance: 200 },
  { name: 'Sneha Patel',    phone: '9123456780', gender: 'female', hasSubscription: false, creditBalance: 75  },
  { name: 'Kabir Verma',    phone: '9009876543', gender: 'male',   hasSubscription: false, creditBalance: 50  },
  { name: 'Nisha Khan',     phone: '9871234560', gender: 'female', hasSubscription: true,  creditBalance: 320 },
  { name: 'Vikram Rao',     phone: '9765432109', gender: 'male',   hasSubscription: false, creditBalance: 50  },
  { name: 'Meera Nair',     phone: '9654321098', gender: 'female', hasSubscription: true,  creditBalance: 90  },
  { name: 'Arjun Kapoor',   phone: '9543210987', gender: 'male',   hasSubscription: false, creditBalance: 50  },
  { name: 'Divya Joshi',    phone: '9432109876', gender: 'female', hasSubscription: false, creditBalance: 50  },
];

const PASSWORD = 'password123'; // all dummy users share the same password

// ── Dummy Booking configs ────────────────────────────────────────────────────
const SOLO_CAR_TYPES  = ['auto', 'mini', 'sedan', 'suv'];
const SHARE_CAR_TYPES = ['4-seater', '6-seater', 'auto'];
const STATUSES        = ['confirmed', 'confirmed', 'confirmed', 'cancelled', 'cancelled'];
const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Wallet', 'RoadGo Credits'];
const SEAT_IDS        = ['F1', 'B1', 'B2', 'B3', 'M1', 'M2', 'R1'];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function upsertUser(client, user, passwordHash) {
  const id = randomUUID();
  await client.query(`
    INSERT INTO users (id, name, phone, gender, "passwordHash", "hasSubscription", "creditBalance", "genderChangeRemaining", "createdAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (phone) DO UPDATE SET
      name = EXCLUDED.name,
      gender = EXCLUDED.gender,
      "hasSubscription" = EXCLUDED."hasSubscription",
      "creditBalance" = EXCLUDED."creditBalance"
  `, [id, user.name, user.phone, user.gender, passwordHash, user.hasSubscription, user.creditBalance, 1, new Date()]);
  return user.phone;
}

async function insertBooking(client, phone) {
  const mode    = Math.random() < 0.55 ? 'solo' : 'sharing';
  const carType = mode === 'solo' ? pickRandom(SOLO_CAR_TYPES) : pickRandom(SHARE_CAR_TYPES);
  const [pickup, drop] = pickTwo(locations);
  const travelDate  = randomDate(30);
  const travelTime  = randomTime();
  const status      = pickRandom(STATUSES);
  const fare        = randomFare(mode, carType);
  const payment     = pickRandom(PAYMENT_METHODS);
  const bookingId   = randomUUID();
  const receiptCode = 'RG' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const qrCodeText  = `ROADGO|${bookingId}|${phone}|${travelDate}|${travelTime}`;
  const cancellationCharge = status === 'cancelled' ? Math.min(fare * 0.15, 30) : 0;
  const rideId      = `${mode === 'solo' ? 'solo-' + carType : 'sh-' + carType.replace('-seater','') + '-a'}-${travelDate}`;
  const seatId      = mode === 'sharing' ? pickRandom(SEAT_IDS) : null;

  await client.query(`
    INSERT INTO bookings
      ("bookingId","userPhone",mode,"pickupName","dropName","travelDate","travelTime","carType","rideId","selectedSeatId","amountPaid","paymentMethod","receiptCode","qrCodeText",status,"cancellationCharge","createdAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT DO NOTHING
  `, [bookingId, phone, mode, pickup.name, drop.name, travelDate, travelTime, carType, rideId, seatId, fare, payment, receiptCode, qrCodeText, status, cancellationCharge, new Date()]);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const client = await pool.connect();
try {
  console.log('🔌 Connected to Neon DB');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Seed users
  console.log('\n👤 Seeding users...');
  for (const user of USERS) {
    await upsertUser(client, user, passwordHash);
    console.log(`  ✅ ${user.name} (${user.phone})`);
  }

  // Seed bookings — 4–6 per user
  console.log('\n🚗 Seeding bookings...');
  for (const user of USERS) {
    const count = 4 + Math.floor(Math.random() * 3); // 4–6 bookings each
    for (let i = 0; i < count; i++) {
      await insertBooking(client, user.phone);
    }
    console.log(`  ✅ ${count} bookings for ${user.name}`);
  }

  // Summary
  const { rows: [uCount] } = await client.query('SELECT COUNT(*) FROM users');
  const { rows: [bCount] } = await client.query('SELECT COUNT(*) FROM bookings');
  console.log(`\n🎉 Done!`);
  console.log(`   📦 Total users:    ${uCount.count}`);
  console.log(`   📦 Total bookings: ${bCount.count}`);
  console.log(`\n🔑 All dummy users share password: ${PASSWORD}`);

} finally {
  client.release();
  await pool.end();
}
