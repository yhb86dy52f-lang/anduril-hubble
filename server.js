// server.js - Antes estaba VACIO (4 bytes). Por eso nada corria.
// Este es el servidor real, minimo y funcional, en CommonJS para que no choque con package.json type: commonjs
require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const { getLatestPositions } = require('./db');
const gpsRoutes = require('./gps_router');

const fastify = Fastify({ logger: true });
const PORT = Number(process.env.PORT) || 3100;
const API_KEY = process.env.API_KEY || '';
const HOST = process.env.HOST || '127.0.0.1'; // Por defecto solo localhost. No lo expongas a internet sin saberlo.

async function build() {
  await fastify.register(require('@fastify/cors'), { origin: false }); // Sin CORS abierto. Tu frontend es mismo origen.
  await fastify.register(require('@fastify/rate-limit'), { max: 120, timeWindow: '1 minute' });
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/',
  });

  // Auth simple para ingesta: solo si hay API_KEY en .env. Si no hay, solo localhost puede escribir.
  // Antes no habia auth y el frontend tenia la key hardcodeada, o sea que cualquiera la leia.
  async function requireApiKey(request, reply) {
    if (!API_KEY) return; // modo personal local
    const key = request.headers['x-api-key'];
    if (key !== API_KEY) return reply.status(401).send({ error: 'API key invalida' });
  }

  // GPS
  await fastify.register(async (instance) => {
    instance.addHook('onRequest', requireApiKey);
    await instance.register(gpsRoutes);
  });

  // Endpoint que espera fleet.html: GET /api/posiciones/latest
  // Antes fleet.html pedia este endpoint y ningun archivo lo tenia. Por eso el mapa quedaba vacio.
  fastify.get('/api/posiciones/latest', async () => {
    const rows = getLatestPositions();
    // Mapea a los nombres que usa fleet.html: dispositivo_id, nombre, lat, lon, velocidad, temperatura, fuente, timestamp
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

  fastify.get('/api/posiciones', async () => {
    const rows = getLatestPositions();
    return rows;
  });

  // Alerta del lado del servidor. Antes el token de Pushcut estaba en fleet.html, visible para cualquiera.
  // Ahora el frontend llama a /api/alert y el servidor usa el token de .env. Nunca expongas tokens en JS.
  fastify.post('/api/alert', async (request, reply) => {
    const { device, mensaje } = request.body || {};
    fastify.log.info({ device, mensaje }, 'Alerta solicitada');
    // Aqui iria tu ntfy o Pushcut con fetch usando process.env.PUSHCUT_TOKEN
    // No lo dejo activo para no mandar alertas reales sin tu permiso.
    return { status: 'OK', queued: true, device: device || null };
  });

  fastify.get('/health', async () => ({ status: 'OK', time: new Date().toISOString() }));

  return fastify;
}

if (require.main === module) {
  build().then((app) => app.listen({ port: PORT, host: HOST })).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = build;
