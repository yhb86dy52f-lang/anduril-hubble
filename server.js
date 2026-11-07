const path = require('path');
const hubbleRoutes = require('./hubble-routes');
const pockethookRoutes = require('./pockethook_routes');
const fs = require('fs');
const Fastify = require('fastify');

function safeRequire(p) { const m = require(p); return m.default || m; }
const cors = safeRequire('@fastify/cors');
const websocket = safeRequire('@fastify/websocket');
const statik = safeRequire('@fastify/static');
const gpsModule = safeRequire('./gps_router');
const gpsRoutes = gpsModule.gpsRoutes || gpsModule.default || gpsModule;
const wsBroadcast = safeRequire('./ws-broadcast');
const API_KEY = process.env.API_KEY || '';
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';

async function build() {
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);
  
  fastify.addHook('onRequest', async (req, reply) => {
    const url = req.url || '';
    if (url.startsWith('/api/')) {
      const key = req.headers['x-api-key'];
      if (API_KEY && key !== API_KEY) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return; }
    }
  });
  
  fastify.get('/', async (request, reply) => {
    return reply.redirect('/fleet.html');
  });

  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket || connection;
    try { wsBroadcast.addSocket(socket); } catch (e) {}
    try { socket.send(JSON.stringify({ type: 'hello', msg: 'conectado a NEXUS-SENTINEL' })); } catch (e) {}
    socket.on('close', () => { try { wsBroadcast.removeSocket(socket); } catch (e) {} });
    socket.on('error', () => { try { wsBroadcast.removeSocket(socket); } catch (e) {} });
  });

  fastify.get('/api/ble/status', async () => { return { ok: true, status: 'no-ble', msg: 'stub' }; });
  fastify.get('/health', async () => { return { ok: true, service: 'NEXUS-SENTINEL' }; });
  
  fastify.get('/api/posiciones/latest', async () => {
    try {
      const dbMod = safeRequire('./db');
      if (typeof dbMod.getLatestPositions === 'function') {
        const rows = dbMod.getLatestPositions();
        return rows.map((r) => ({ dispositivo_id: r.device || r.dispositivo_id || r.deviceId, nombre: r.nombre || r.device || r.dispositivo_id, lat: r.lat, lon: r.lon, velocidad: r.velocidad || 0, temperatura: r.temperatura || null, fuente: r.fuente || 'hubble', timestamp: r.timestamp || r.ts, rssi: r.rssi }));
      }
    } catch (e) { fastify.log.error(e); }
    return [];
  });

  fastify.get('/api/posiciones/history', async (req) => {
    try {
      const { getHistory } = require('./history');
      const device = req.query.device || req.query.deviceId || req.query.mac || null;
      const limit = parseInt(req.query.limit || 100, 10) || 100;
      const rows = device ? getHistory(device, limit) : getHistory(null, limit);
      return Array.isArray(rows) ? rows : [];
    } catch (e) { fastify.log.error(e); return []; }
  });

  // RUTA NTFY (Reparada para buscar número o mandar null)
  fastify.post('/api/ntfy/send-sms', async (request, reply) => {
    try {
      let { deviceId, phoneNumber, command } = request.body || {};
      if (!deviceId) return reply.status(400).send({ error: 'Falta deviceId' });
      let key = String(deviceId).toUpperCase().trim().replace(/\s+/g, ' ');
      key = key.replace(/^(CT|KW)\s*(\d+)/, '$1 $2');
      
      if (!phoneNumber) {
        const phonesPath = path.join(__dirname, 'data', 'device_phones.json');
        if (fs.existsSync(phonesPath)) {
          const phones = JSON.parse(fs.readFileSync(phonesPath, 'utf8'));
          phoneNumber = phones[key] || phones[String(deviceId).toUpperCase().trim()] || null;
        }
      }
      
      const NTFY_TOPIC = process.env.NTFY_TOPIC || 'runeforge-comando-anduril';
      const ntfyUrl = 'https://ntfy.sh/' + NTFY_TOPIC;
      const payload = { deviceId, phoneNumber: phoneNumber || null, command: command || '!R5' };
      const shortcutUrl = 'shortcuts://run-shortcut?name=Comando%20Anduril&input=text&text=' + encodeURIComponent(JSON.stringify(payload));
      
      const response = await fetch(ntfyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: NTFY_TOPIC,
          message: 'Comando para ' + deviceId + ': ' + (command || '!R5'),
          title: 'Comando Anduril',
          priority: 5,
          tags: ['robot'],
          actions: [{ action: 'view', label: 'Ejecutar Atajo', url: shortcutUrl }]
        })
      });
      if (!response.ok) return reply.status(502).send({ error: 'ntfy rechazó' });
      return reply.send({ status: 'OK', deviceId, phoneNumber: phoneNumber || null, command: command || '!R5' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Error contactando ntfy' });
    }
  });

  if (typeof gpsRoutes === 'function') { await fastify.register(gpsRoutes); }
  await fastify.register(statik, { root: path.join(__dirname, 'public'), prefix: '/' });
  await fastify.register(hubbleRoutes);
  await fastify.register(pockethookRoutes);
  return fastify;
}

async function main() {
  const fastify = await build();
  try { await fastify.listen({ port: PORT, host: HOST }); } catch (err) { fastify.log.error(err); process.exit(1); }
}
if (require.main === module) { main(); }
module.exports = { build };