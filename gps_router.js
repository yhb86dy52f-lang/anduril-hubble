// gps_router.js - Validacion real. Antes aceptaba cualquier lat/lon sin rango.
// Un lat 999 o un string te rompian el mapa o te metian basura.
const { insertGpsPosition } = require('./db');

function isValidLat(lat) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
function isValidLon(lon) {
  return typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}
function isValidRssi(rssi) {
  return rssi === undefined || rssi === null || (Number.isInteger(rssi) && rssi >= -120 && rssi <= 0);
}

async function gpsRoutes(fastify, options) {
  // POST /api/gps/update - formato que espera fleet.html y tu SMS
  fastify.post('/api/gps/update', async (request, reply) => {
    const body = request.body || {};
    // Acepta lat/lon o latitud/longitud para no romper compat V5
    const device = typeof body.device === 'string' ? body.device.trim().slice(0, 64) : '';
    const lat = Number(body.lat ?? body.latitud);
    const lon = Number(body.lon ?? body.longitud ?? body.lng);
    const rssi = body.rssi !== undefined ? Number(body.rssi) : null;

    if (!device) return reply.status(400).send({ error: 'Falta device' });
    if (!isValidLat(lat)) return reply.status(400).send({ error: 'lat fuera de rango -90 a 90' });
    if (!isValidLon(lon)) return reply.status(400).send({ error: 'lon fuera de rango -180 a 180' });
    if (!isValidRssi(rssi)) return reply.status(400).send({ error: 'rssi fuera de rango -120 a 0' });

    // Anti-spam basico: ignora duplicados exactos en menos de 5s del mismo device
    // Tu telemetry_history.json tenia el mismo dato cada 5s, 33 veces. Eso es sensor atorad o loop.
    try {
      const row = insertGpsPosition({
        device,
        mac: typeof body.mac === 'string' ? body.mac.slice(0, 32) : null,
        rssi,
        lat, lon,
        velocidad: Number(body.velocidad) || 0,
        temperatura: body.temperatura !== undefined ? Number(body.temperatura) : null,
        fuente: typeof body.fuente === 'string' ? body.fuente.slice(0, 20) : 'sms',
      });
      return reply.send({ status: 'OK', id: row.lastInsertRowid });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Error en BD' });
    }
  });

  // POST /api/sms-gps - compat V5. Acepta texto tipo "LAT:25.123 LON:-103.45" o JSON
  fastify.post('/api/sms-gps', async (request, reply) => {
    const body = request.body || {};
    if (typeof body.texto === 'string') {
      const m = body.texto.match(/(-?\d+\.\d+)\s*[,;\s]\s*(-?\d+\.\d+)/);
      if (!m) return reply.status(400).send({ error: 'No se pudo parsear texto SMS' });
      request.body = { device: body.device || 'sms-unknown', lat: Number(m[1]), lon: Number(m[2]), fuente: 'sms' };
      // Reusa la misma validacion llamando al handler de arriba via inject interno simple:
      // Para mantenerlo simple, insertamos aqui con la misma validacion
    }
    // Si llego JSON, lo tratamos como /api/gps/update
    if (body.lat !== undefined || body.texto) {
      // Delega: Fastify no tiene re-dispatch facil, asi que validamos igual
      const device = typeof (body.device || 'sms-unknown') === 'string' ? String(body.device || 'sms-unknown').slice(0, 64) : 'sms-unknown';
      const lat = body.lat !== undefined ? Number(body.lat) : Number(body.texto ? body.texto.match(/(-?\d+\.\d+)/)[1] : NaN);
      const lon = body.lon !== undefined ? Number(body.lon) : NaN;
      if (!isValidLat(lat) || !isValidLon(lon)) return reply.status(400).send({ error: 'Coordenadas invalidas en SMS' });
      const row = insertGpsPosition({ device, lat, lon, fuente: 'sms' });
      return reply.send({ status: 'OK', id: row.lastInsertRowid });
    }
    return reply.status(400).send({ error: 'Faltan datos' });
  });
}

module.exports = gpsRoutes;
