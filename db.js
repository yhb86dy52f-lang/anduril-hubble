// db.js - Una sola DB, una sola libreria: better-sqlite3
// Antes tenias dos DBs y dos librerias (better-sqlite3 en db.js, sqlite3 en gps_router.js)
// Eso hacia que frontend y backend hablaran de tablas distintas.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'telemetry.db');
const db = new Database(dbPath);

// WAL = no se bloquea con lecturas mientras escribes. Para tu uso es suficiente.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS gps_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device TEXT NOT NULL,
    mac TEXT,
    rssi INTEGER,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    velocidad REAL DEFAULT 0,
    temperatura REAL,
    fuente TEXT DEFAULT 'sms',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_gps_device ON gps_positions(device);
  CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_positions(timestamp);

  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    mac TEXT NOT NULL,
    name TEXT,
    rssi INTEGER,
    distance REAL
  );
  CREATE INDEX IF NOT EXISTS idx_telemetry_mac ON telemetry(mac);
`);

const insertGps = db.prepare(
  'INSERT INTO gps_positions (device, mac, rssi, lat, lon, velocidad, temperatura, fuente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const latestPerDevice = db.prepare(`
  SELECT * FROM gps_positions WHERE id IN (
    SELECT MAX(id) FROM gps_positions GROUP BY device
  ) ORDER BY timestamp DESC
`);
const insertTelemetry = db.prepare(
  'INSERT INTO telemetry (mac, name, rssi, distance) VALUES (?, ?, ?, ?)'
);

function insertGpsPosition(data) {
  return insertGps.run(data.device, data.mac || null, data.rssi ?? null, data.lat, data.lon, data.velocidad ?? 0, data.temperatura ?? null, data.fuente || 'sms');
}

function getLatestPositions() {
  return latestPerDevice.all();
}

function logTelemetry(data) {
  insertTelemetry.run(data.mac, data.name || null, data.rssi ?? null, data.distance ?? 0);
}

function getHistory(mac, limit = 100) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
  if (mac) return db.prepare('SELECT * FROM telemetry WHERE mac = ? ORDER BY id DESC LIMIT ?').all(mac, safeLimit);
  return db.prepare('SELECT * FROM telemetry ORDER BY id DESC LIMIT ?').all(safeLimit);
}

module.exports = { db, insertGpsPosition, getLatestPositions, logTelemetry, getHistory };
