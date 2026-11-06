const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'public', 'fleet.html');
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Inyectar función timeAgo si no existe
if (!content.includes('function timeAgo')) {
  const timeAgoFunc = `
// ═══════════════════════════════════════════════════════════
// FUNCIÓN TIMEAGO (INYECTADA POR RUNEFORGE)
// ═══════════════════════════════════════════════════════════
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
// ═══════════════════════════════════════════════════════════

`;
  // Insertar antes de la primera función (usualmente 'function makeIcon' o 'function renderList')
  const firstFuncIndex = content.indexOf('function ');
  if (firstFuncIndex !== -1) {
    content = content.slice(0, firstFuncIndex) + timeAgoFunc + content.slice(firstFuncIndex);
    console.log('   [OK] timeAgo inyectado.');
  } else {
    console.warn('   [!] No se encontró un lugar para inyectar timeAgo.');
  }
} else {
  console.log('   [i] timeAgo ya existía.');
}

// 2. Reemplazar todas las llamadas a fmtTime por timeAgo
const originalContent = content;
content = content.replace(/fmtTime\(/g, 'timeAgo(');

if (content !== originalContent) {
  console.log('   [OK] Llamadas a fmtTime reemplazadas por timeAgo.');
} else {
  console.log('   [!] No se encontraron llamadas a fmtTime.');
}

// 3. Guardar
fs.writeFileSync(htmlFile, content, 'utf8');
console.log('   [OK] Archivo fleet.html actualizado.');
