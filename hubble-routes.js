// hubble-routes.js - Rutas de Hubble (CommonJS)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

module.exports = async function hubbleRoutes(fastify, opts) {
  const dbPath = path.join(__dirname, 'data', 'hubble.db');
  let db = null;
  try {
    if (fs.existsSync(dbPath)) {
      db = new Database(dbPath, { readonly: true });
    }
  } catch (e) {
    console.error('Error abriendo hubble.db:', e.message);
  }

  fastify.get('/api/hubble/devices', async () => {
    if (!db) return [];
    const rows = db.prepare(`
      SELECT h.*, 
        (SELECT COUNT(*) FROM hubble_packets WHERE device_id = h.device_id) as packet_count
      FROM hubble_packets h
      WHERE h.id IN (SELECT MAX(id) FROM hubble_packets GROUP BY device_id)
      ORDER BY h.timestamp DESC
    `).all();
    return rows.map(r => ({
      device_id: r.device_id,
      name: r.device_name || r.device_id,
      lat: r.lat,
      lon: r.lon,
      last_packet_ts: r.timestamp,
      payload: r.payload,
      network: r.network,
      packet_count: r.packet_count,
      is_online: (Date.now() / 1000 - r.timestamp) < 3600
    }));
  });

  fastify.get('/api/hubble/packets/:deviceId', async (req) => {
    if (!db) return [];
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    return db.prepare(
      'SELECT * FROM hubble_packets WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(req.params.deviceId, limit);
  });

  fastify.get('/api/hubble/stats', async () => {
    if (!db) return { devices: 0, packets: 0 };
    const devices = db.prepare('SELECT COUNT(DISTINCT device_id) as n FROM hubble_packets').get().n;
    const packets = db.prepare('SELECT COUNT(*) as n FROM hubble_packets').get().n;
    const last = db.prepare('SELECT MAX(received_at) as t FROM hubble_packets').get().t;
    return { devices, packets, last_received: last };
  });
};
