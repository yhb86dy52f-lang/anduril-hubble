require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const https = require('https');

// ─── CONFIG ───
const ORG_ID = "process.env.HUBBLE_ORG_ID";
const TOKEN  = "process.env.HUBBLE_TOKEN";
const DB_PATH = path.join(__dirname, 'data', 'hubble.db');
const POLL_INTERVAL_MS = 30000;

// ─── DB ───
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS hubble_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    device_name TEXT,
    timestamp REAL,
    lat REAL,
    lon REAL,
    payload TEXT,
    network TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_packet ON hubble_packets(device_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_device ON hubble_packets(device_id);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON hubble_packets(timestamp);
`);
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO hubble_packets (device_id, device_name, timestamp, lat, lon, payload, network)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ─── API ───
function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ body: JSON.parse(data), headers: res.headers, status: res.statusCode }); }
        catch (e) { reject(new Error(`Parse error: ${e.message} | raw: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

// Cache de nombres de dispositivos
const deviceNames = new Map();
async function loadDevices() {
  try {
    const r = await httpGet(`https://api.hubble.com/v2/org/${ORG_ID}/devices?limit=1000`, 
      { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' });
    const devices = Array.isArray(r.body) ? r.body : (r.body.devices || []);
    for (const d of devices) {
      deviceNames.set(d.id, d.name);
    }
    console.log(`[${new Date().toISOString()}] Dispositivos cargados: ${devices.length}`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Error cargando devices: ${e.message}`);
  }
}

// Obtener el último timestamp guardado para el paginado incremental
function getLastTimestamp() {
  const row = db.prepare('SELECT MAX(timestamp) as ts FROM hubble_packets').get();
  if (row && row.ts) return row.ts;
  // Si la DB está vacía, empezamos con 7 días atrás para capturar todo
  return Math.floor(Date.now() / 1000) - (7 * 24 * 3600);
}

async function pollPackets() {
  let start = getLastTimestamp();
  const now = Math.floor(Date.now() / 1000);
  if (start >= now) start = now - 60; // margen mínimo

  let totalInserted = 0;
  let continuationToken = null;
  let pageCount = 0;
  const MAX_PAGES = 10; // máximo 10 páginas por ciclo (10,000 paquetes)

  while (pageCount < MAX_PAGES) {
    pageCount++;
    const url = `https://api.hubble.com/v1/org/${ORG_ID}/packets?start=${Math.floor(start)}`;
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    };
    if (continuationToken) headers['Continuation-Token'] = continuationToken;

    let r;
    try {
      r = await httpGet(url, headers);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] HTTP error: ${e.message}`);
      break;
    }
    if (r.status !== 200) {
      console.error(`[${new Date().toISOString()}] API status ${r.status}: ${JSON.stringify(r.body).slice(0,200)}`);
      break;
    }

    const packets = Array.isArray(r.body) ? r.body : (r.body.packets || []);
    if (packets.length === 0) break;

    for (const p of packets) {
      // Estructura esperada de Hubble:
      // p.device.timestamp o p.timestamp, p.device.id o p.device_id
      // p.location.latitude, p.location.longitude
      const deviceId = p.device?.id || p.device_id || 'unknown';
      const deviceName = deviceNames.get(deviceId) || p.device?.name || deviceId;
      const ts = p.device?.timestamp || p.timestamp || p.location?.timestamp;
      const lat = p.location?.latitude ?? null;
      const lon = p.location?.longitude ?? null;
      const payload = p.payload || null;
      const network = p.network || 'terrestrial';

      const res = insertStmt.run(deviceId, deviceName, ts, lat, lon, payload, network);
      if (res.changes > 0) totalInserted++;
    }

    continuationToken = r.headers['continuation-token'];
    if (!continuationToken) break;

    // Rate limit: 2 req/sec → esperamos 500ms entre páginas
    await new Promise(res => setTimeout(res, 500));
  }

  if (totalInserted > 0) {
    console.log(`[${new Date().toISOString()}] Insertados ${totalInserted} paquetes nuevos (${pageCount} páginas)`);
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Hubble Poller iniciado. DB: ${DB_PATH}`);
  await loadDevices();
  // Recargar nombres cada 5 min
  setInterval(loadDevices, 5 * 60 * 1000);
  // Poll cada 30s
  await pollPackets();
  setInterval(pollPackets, POLL_INTERVAL_MS);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

