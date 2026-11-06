const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'telemetry.db');
const db = new Database(dbPath);
const info = db.prepare("DELETE FROM gps_positions WHERE device LIKE 'test%'").run();
console.log(`   [OK] Eliminados ${info.changes} registros de prueba.`);
const remaining = db.prepare('SELECT COUNT(DISTINCT device) as n FROM gps_positions').get().n;
console.log(`   [i] Dispositivos restantes en telemetry.db: ${remaining}`);
db.close();
