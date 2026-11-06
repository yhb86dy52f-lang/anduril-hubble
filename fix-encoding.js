const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'fleet.html');

let content = fs.readFileSync(file, 'utf8');

// Mapeo de cadenas corruptas a emojis correctos
const fixes = {
    'ðŸ“¡': '📡',
    'ðŸš¨': '🚨',
    'ðŸ”': '🔍',
    'â³': '⏳',
    'âš ï¸': '⚠️',
    'â–': '❖',
    'Â°C': '°C',
    'Â': ''
};

let changes = 0;
for (const [bad, good] of Object.entries(fixes)) {
    if (content.includes(bad)) {
        content = content.split(bad).join(good);
        changes++;
    }
}

// Verificar que los botones clave sigan presentes
if (!content.includes("SOLICITAR ESTATUS REAL")) throw new Error("No se encontró botón SOLICITAR ESTATUS");
if (!content.includes("ENVIAR ALERTA")) throw new Error("No se encontró botón ENVIAR ALERTA");
if (!content.includes("APAGAR")) throw new Error("No se encontró botón APAGAR");

fs.writeFileSync(file, content, 'utf8');
console.log(`[OK] Archivo limpiado. Reemplazos aplicados: ${changes}`);
