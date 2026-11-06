require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const https = require('https');

const ORG_ID = "process.env.HUBBLE_ORG_ID";
const TOKEN  = "process.env.HUBBLE_TOKEN";
const DB_PATH = path.join(__dirname, 'data', 'hubble.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO hubble_packets (device_id, device_name, timestamp, lat, lon, payload, network)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ body: JSON.parse(data), headers: res.headers, status: res.statusCode }); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// Cache de nombres
const deviceNames = new Map();
async function loadDevices() {
  const r = await httpGet(`https://api.hubble.com/v2/org/${ORG_ID}/devices?limit=1000`,
    { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' });
  const devices = Array.isArray(r.body) ? r.body : (r.body.devices || []);
  for (const d of devices) deviceNames.set(d.id, d.name);
  console.log(`[BACKFILL] Dispositivos cargados: ${devices.length}`);
}

async function backfill() {
  await loadDevices();

  // Rango de 7 días atrás hasta ahora
  const now = Math.floor(Date.now() / 1000);
  const start = now - (7 * 24 * 3600);

  console.log(`[BACKFILL] Rango: ${new Date(start * 1000).toISOString()} -> ${new Date(now * 1000).toISOString()}`);

  let continuationToken = null;
  let pageCount = 0;
  let totalInserted = 0;
  const MAX_PAGES = 50; // hasta 50,000 paquetes

  while (pageCount < MAX_PAGES) {
    pageCount++;
    const url = `https://api.hubble.com/v1/org/${ORG_ID}/packets?start=${start}`;
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    };
    if (continuationToken) headers['Continuation-Token'] = continuationToken;

    let r;
    try {
      r = await httpGet(url, headers);
    } catch (e) {
      console.error(`[BACKFILL] HTTP error: ${e.message}`);
      break;
    }
    if (r.status !== 200) {
      console.error(`[BACKFILL] API status ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
      break;
    }

    const packets = Array.isArray(r.body) ? r.body : (r.body.packets || []);
    if (packets.length === 0) {
      console.log(`[BACKFILL] Sin más paquetes en página ${pageCount}`);
      break;
    }

    let pageInserted = 0;
    for (const p of packets) {
      const deviceId = p.device?.id || p.device_id || 'unknown';
      const deviceName = deviceNames.get(deviceId) || p.device?.name || deviceId;
      const ts = p.device?.timestamp || p.timestamp || p.location?.timestamp;
      const lat = p.location?.latitude ?? null;
      const lon = p.location?.longitude ?? null;
      const payload = p.payload || null;
      const network = p.network || 'terrestrial';

      const res = insertStmt.run(deviceId, deviceName, ts, lat, lon, payload, network);
      if (res.changes > 0) { totalInserted++; pageInserted++; }
    }

    console.log(`[BACKFILL] Página ${pageCount}: ${packets.length} paquetes, ${pageInserted} nuevos.`);

    continuationToken = r.headers['continuation-token'];
    if (!continuationToken) {
      console.log(`[BACKFILL] Fin de stream.`);
      break;
    }
    await new Promise(res => setTimeout(res, 500)); // rate limit
  }

  // Resumen final
  const devices = db.prepare('SELECT COUNT(DISTINCT device_id) as n FROM hubble_packets').get().n;
  const packets = db.prepare('SELECT COUNT(*) as n FROM hubble_packets').get().n;
  console.log(`\n[BACKFILL] COMPLETADO.`);
  console.log(`  Total dispositivos en DB: ${devices}`);
  console.log(`  Total paquetes en DB: ${packets}`);
  console.log(`  Nuevos insertados esta ejecución: ${totalInserted}`);

  db.close();
}

backfill().catch(e => { console.error('FATAL:', e); process.exit(1); });
