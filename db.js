const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'telemetry.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS gps_positions (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT NOT NULL, mac TEXT, rssi INTEGER, lat REAL NOT NULL, lon REAL NOT NULL, velocidad REAL DEFAULT 0, temperatura REAL, fuente TEXT DEFAULT 'sms', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_gps_device ON gps_positions(device);`);
const insertGps = db.prepare('INSERT INTO gps_positions (device, mac, rssi, lat, lon, velocidad, temperatura, fuente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const latestPerDevice = db.prepare(`SELECT * FROM gps_positions WHERE id IN (SELECT MAX(id) FROM gps_positions GROUP BY device) ORDER BY timestamp DESC`);
function insertGpsPosition(data) { return insertGps.run(data.device, data.mac || null, data.rssi ?? null, data.lat, data.lon, data.velocidad ?? 0, data.temperatura ?? null, data.fuente || 'sms'); }
function getLatestPositions() { return latestPerDevice.all(); }
module.exports = { db, insertGpsPosition, getLatestPositions };