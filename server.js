require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const { getLatestPositions } = require('./db');
const gpsRoutes = require('./gps_router');
const { addSocket, removeSocket } = require('./ws-broadcast');

const fastify = Fastify({ logger: true });
const PORT = Number(process.env.PORT) || 3100;
const API_KEY = process.env.API_KEY || 'RF-NEXUS-SECURE-2026';
const HOST = process.env.HOST || '0.0.0.0';

async function build() {
  await fastify.register(require('@fastify/cors'), { origin: false });
  await fastify.register(require('@fastify/websocket'));
  
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket || connection;
    addSocket(socket);
    socket.on('close', () => removeSocket(socket));
    try { socket.send(JSON.stringify({ type: 'hello', msg: 'conectado a NEXUS-SENTINEL' })); } catch(e) {}
  });
  
  await fastify.register(require('@fastify/rate-limit'), { max: 120, timeWindow: '1 minute' });
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/',
  });

  async function requireApiKey(request, reply) {
    if (!API_KEY) return;
    const key = request.headers['x-api-key'];
    if (key !== API_KEY) return reply.status(401).send({ error: 'API key invalida' });
  }

  await fastify.register(async (instance) => {
    instance.addHook('onRequest', requireApiKey);
    await instance.register(gpsRoutes);
  });

  fastify.get('/api/posiciones/latest', async () => {
    const rows = getLatestPositions();
    return rows.map((r) => ({
      dispositivo_id: r.device,
      mid: r.device,
      nombre: r.device,
      lat: r.lat,
      lon: r.lon,
      velocidad: r.velocidad ?? 0,
      temperatura: r.temperatura ?? null,
      fuente: r.fuente || 'sms',
      timestamp: r.timestamp,
    }));
  });

  // RUTA NTFY (AQUÍ ESTÁ LA MAGIA SIN BLOQUEOS)
  fastify.post('/api/ntfy/send-sms', async (request, reply) => {
    try {
      let { deviceId, phoneNumber, command } = request.body || {};
      if (!deviceId) return reply.status(400).send({ error: 'Falta deviceId' });
      
      if (!phoneNumber) {
        const fs = require('fs');
        const phonesPath = path.join(__dirname, 'data', 'device_phones.json');
        if (fs.existsSync(phonesPath)) {
          const phones = JSON.parse(fs.readFileSync(phonesPath, 'utf8'));
          const cleanId = String(deviceId).toUpperCase().trim();
          phoneNumber = phones[cleanId];
          if (!phoneNumber) {
            const match = cleanId.match(/(KW\s*\d+|CT\s*\d+)/i);
            if (match) {
              const key = match[1].toUpperCase().replace(/\s+/g, ' ').trim();
              phoneNumber = phones[key];
            }
          }
        }
      }
      
      // Si no hay teléfono, NO tronamos, solo mandamos null al iPhone
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
      
      if (!response.ok) return reply.status(502).send({ error: 'ntfy rechazó la notificación' });
      return reply.send({ status: 'OK', deviceId, phoneNumber: phoneNumber || null, command: command || '!R5' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Error contactando ntfy' });
    }
  });

  fastify.get('/health', async () => ({ status: 'OK', time: new Date().toISOString() }));
  return fastify;
}

if (require.main === module) {
  build().then((app) => app.listen({ port: PORT, host: HOST })).catch((err) => { console.error(err); process.exit(1); });
}
module.exports = build;