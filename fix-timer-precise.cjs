const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'public', 'fleet.html');
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Asegurar que la función timeAgo exista
if (!content.includes('function timeAgo')) {
  const timeAgoFunc = `
function timeAgo(ts) {
  if (!ts) return '--';
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffSecs = Math.floor((now - then) / 1000);
  if (diffSecs < 0) return 'ahora';
  if (diffSecs < 5) return 'ahora mismo';
  if (diffSecs < 60) return 'hace ' + diffSecs + ' seg';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return 'hace ' + diffMins + ' min';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return 'hace ' + diffHours + ' hr';
  const diffDays = Math.floor(diffHours / 24);
  return 'hace ' + diffDays + ' días';
}
`;
  // Insertar antes de la primera función
  const firstFunc = content.indexOf('function ');
  if (firstFunc !== -1) {
    content = content.slice(0, firstFunc) + timeAgoFunc + content.slice(firstFunc);
  }
}

// 2. Reemplazar la generación de la lista lateral (renderList)
// Buscamos el bloque exacto donde se imprime la fecha en el sidebar
const oldListFormat = `<div class="dev-stats"><span>Velocidad <b>'+esc(String(vel))+' km/h</b></span><span>Temp <b>'+esc(String(temp))+' &deg;C</b></span><span>'+fmtTime(p.timestamp)+'</span></div>`;
const newListFormat = `<div class="dev-stats"><span>Velocidad <b>'+esc(String(vel))+' km/h</b></span><span>Temp <b>'+esc(String(temp))+' &deg;C</b></span><span style="color:var(--cyan); font-weight:bold;">'+timeAgo(p.timestamp)+'</span></div>`;

if (content.includes(oldListFormat)) {
    content = content.replace(oldListFormat, newListFormat);
    console.log('   [OK] Sidebar actualizado con timeAgo.');
} else {
    // Si la cadena exacta no coincide, usamos un reemplazo más flexible
    content = content.replace(/\+fmtTime\(p\.timestamp\)\+/g, '+timeAgo(p.timestamp)+');
    console.log('   [OK] Sidebar actualizado (fallback regex).');
}

// 3. Reemplazar en el panel de detalles (info-subtitle y pill)
content = content.replace(/fmtTime\(p\.timestamp\)/g, 'timeAgo(p.timestamp)');
console.log('   [OK] Panel de detalles actualizado.');

// 4. Guardar el archivo
fs.writeFileSync(htmlFile, content, 'utf8');
console.log('   [OK] fleet.html guardado.');
