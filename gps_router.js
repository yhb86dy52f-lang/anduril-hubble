const { insertGpsPosition } = require('./db');
const { checkGeofences } = require('./geofence');

function isValidLat(lat) { return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90; }
function isValidLon(lon) { return typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180; }
function isValidRssi(rssi) { return rssi === undefined || rssi === null || (Number.isInteger(rssi) && rssi >= -120 && rssi <= 0); }

async function gpsRoutes(fastify, options) {
  fastify.post('/api/gps/update', async (request, reply) => {
    const body = request.body || {};
    const device = typeof body.device === 'string' ? body.device.trim().slice(0, 64) : '';
    const lat = Number(body.lat ?? body.latitud);
    const lon = Number(body.lon ?? body.longitud ?? body.lng);
    const rssi = body.rssi !== undefined ? Number(body.rssi) : null;

    if (!device) return reply.status(400).send({ error: 'Falta device' });
    if (!isValidLat(lat)) return reply.status(400).send({ error: 'lat fuera de rango' });
    if (!isValidLon(lon)) return reply.status(400).send({ error: 'lon fuera de rango' });
    
    const eventos = checkGeofences(device, lat, lon);
    for (const e of eventos) { fastify.log.info(`[GEOCERCAS] ${e.deviceId} ${e.tipo} ${e.nombre}`); }
    
    try {
      const row = insertGpsPosition({
        device, mac: typeof body.mac === 'string' ? body.mac.slice(0, 32) : null, rssi, lat, lon,
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

  fastify.post('/api/sms-gps', async (request, reply) => {
    const body = request.body || {};
    const texto = typeof body.texto === 'string' ? body.texto : '';
    let device = body.device || body.deviceId || 'sms-unknown';
    let lat = null, lon = null, rssi = null;

    if (texto) {
      const midMatch = texto.match(/MID:\s*(\d+)/i) || texto.match(/ESN:\s*(\d+)/i);
      if (midMatch) device = midMatch[1];

      const latLonMatch = texto.match(/LAT:\s*([-]?\d+\.\d+)\s*LON:\s*([-]?\d+\.\d+)/i) || texto.match(/([-]?\d{2,3}\.\d+)\s*[,;\s]\s*([-]?\d{2,3}\.\d+)/);
      if (latLonMatch) { lat = parseFloat(latLonMatch[1]); lon = parseFloat(latLonMatch[2]); }
      
      const comMatch = texto.match(/COM:\s*(-?\d+)/i);
      if (comMatch) rssi = parseInt(comMatch[1], 10);
    }

    if (body.lat !== undefined && body.lon !== undefined) {
      lat = Number(body.lat); lon = Number(body.lon);
    }

    if (lat !== null && lon !== null) {
      if (!isValidLat(lat) || !isValidLon(lon)) return reply.status(400).send({ error: 'Coordenadas invalidas' });
      
      const eventos = checkGeofences(device, lat, lon);
      for (const e of eventos) { fastify.log.info(`[GEOCERCAS] ${e.deviceId} ${e.tipo} ${e.nombre}`); }

      try {
        const row = insertGpsPosition({ device, lat, lon, rssi: isValidRssi(rssi) ? rssi : null, velocidad: 0, fuente: 'sms' });
        fastify.log.info(`[SMS GPS] Ubicación guardada para ${device} (Lat: ${lat}, Lon: ${lon})`);
        return reply.send({ status: 'OK', message: 'SMS procesado', id: row.lastInsertRowid, device, lat, lon });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Error en BD' });
      }
    } 
    
    fastify.log.info(`[SMS GPS] Estatus recibido de ${device} (sin coordenadas)`);
    return reply.send({ status: 'OK', message: 'SMS de estatus recibido' });
  });
}

module.exports = gpsRoutes;