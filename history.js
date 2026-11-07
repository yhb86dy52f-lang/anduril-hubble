const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'nexus_history.db');
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS gps_history (id INTEGER PRIMARY KEY AUTOINCREMENT, deviceId TEXT, lat REAL, lon REAL, rssi INTEGER, ts INTEGER)`);
function savePosition(deviceId, lat, lon, rssi) { try { db.prepare('INSERT INTO gps_history (deviceId, lat, lon, rssi, ts) VALUES (?, ?, ?, ?, ?)').run(deviceId, lat, lon, rssi || null, Date.now()); } catch (e) { console.error(e); } }
function getHistory(deviceId, limit) { try { const lim = Math.min(parseInt(limit) || 200, 1000); if (deviceId) return db.prepare('SELECT deviceId, lat, lon, rssi, ts FROM gps_history WHERE deviceId = ? ORDER BY ts ASC LIMIT ?').all(deviceId, lim); return db.prepare('SELECT deviceId, lat, lon, rssi, ts FROM gps_history ORDER BY ts ASC LIMIT ?').all(lim); } catch (e) { return []; } }
module.exports = { savePosition, getHistory };