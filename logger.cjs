const fs = require('fs');
const http = require('http');
const path = require('path');
const { logTelemetry } = require('./db'); // Importar la función del nuevo db.js

const LOG_FILE = path.join(__dirname, 'telemetry_history.jsonl');

function logData() {
  const req = http.get('http://127.0.0.1:3100/api/ble/status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json && json.length > 0) {
          const dev = json[0];
          const record = {
            t: new Date().toISOString(),
            name: dev.name,
            mac: dev.address,
            rssi: dev.rssi,
            dist: dev.distance_m_est
          };
          
          // Guardar en JSONL
          fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
          
          // Guardar en SQLite usando la función del nuevo db.js
          logTelemetry({
            mac: dev.address,
            name: dev.name,
            rssi: dev.rssi,
            distance: dev.distance_m_est || 0
          });
          
        }
      } catch (e) {
        // Silencioso si no hay datos o falla la API
      }
    });
  });
  req.on('error', (err) => {});
}
setInterval(logData, 5000);
console.log('📡 Logger conectado a la nueva arquitectura SQLite.');
