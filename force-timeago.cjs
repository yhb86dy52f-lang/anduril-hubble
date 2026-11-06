const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'public', 'fleet.html');
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Asegurar que timeAgo exista
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
  const firstFunc = content.indexOf('function ');
  if (firstFunc !== -1) {
    content = content.slice(0, firstFunc) + timeAgoFunc + content.slice(firstFunc);
  }
}

// 2. Reemplazo GLOBAL de fmtTime por timeAgo (sin importar los argumentos)
content = content.replace(/fmtTime\(/g, 'timeAgo(');

// 3. Guardar
fs.writeFileSync(htmlFile, content, 'utf8');
console.log('   [OK] Reemplazo global aplicado.');
