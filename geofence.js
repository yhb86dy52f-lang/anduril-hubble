const fs = require('fs');
const path = require('path');

const geofencesPath = path.join(__dirname, 'geofences.json');
const geofences = JSON.parse(fs.readFileSync(geofencesPath, 'utf8'));

// Estado en memoria: deviceId -> { [geofenceId]: bool dentro }
const estado = new Map();

function pointInPolygon(lat, lon, polygon) {
  let dentro = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
}

function checkGeofences(deviceId, lat, lon) {
  if (!estado.has(deviceId)) estado.set(deviceId, {});
  const prev = estado.get(deviceId);
  const eventos = [];

  for (const g of geofences) {
    const ahoraDentro = pointInPolygon(lat, lon, g.polygon);
    const antesDentro = prev[g.id] || false;
    if (ahoraDentro && !antesDentro) eventos.push({ tipo: 'entro', geofence: g.id, nombre: g.nombre, deviceId, lat, lon, ts: Date.now() });
    if (!ahoraDentro && antesDentro) eventos.push({ tipo: 'salio', geofence: g.id, nombre: g.nombre, deviceId, lat, lon, ts: Date.now() });
    prev[g.id] = ahoraDentro;
  }
  return eventos;
}

module.exports = { pointInPolygon, checkGeofences, geofences };
