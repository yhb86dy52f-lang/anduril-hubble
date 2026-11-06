$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE

try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\server.js" "$BASE\server.js.bak-plugin" -Force
    Copy-Item "$BASE\package.json" "$BASE\package.json.bak-plugin" -Force
    if (Test-Path "$BASE\gps_router.js") { Copy-Item "$BASE\gps_router.js" "$BASE\gps_router.js.bak-plugin" -Force }

    Write-Host "[2] Diagnostico - que hay en server.js:47" -ForegroundColor Cyan
    $serverTexto = Get-Content "$BASE\server.js" -Raw
    $lineas = Get-Content "$BASE\server.js"
    if ($lineas.Count -ge 47) {
        Write-Host ("Linea 40-55 de server.js:") -ForegroundColor Yellow
        for ($i = 39; $i -lt 55; $i++) {
            if ($i -lt $lineas.Count) { Write-Host (($i + 1).ToString() + ": " + $lineas[$i]) }
        }
    }
    Write-Host "[2.1] Tipo de cada require - debe ser function" -ForegroundColor Cyan
    node -e "try{console.log('websocket type:', typeof (require('./node_modules/@fastify/websocket'))); console.log('websocket default type:', typeof (require('./node_modules/@fastify/websocket').default));}catch(e){console.log('websocket error:', e.message)}"
    node -e "try{console.log('gps_router type:', typeof (require('./gps_router.js'))); console.log('gps_router keys:', Object.keys(require('./gps_router.js')));}catch(e){console.log('gps_router error:', e.message)}"
    node -e "try{console.log('package type:', require('./package.json').type);}catch(e){console.log('package error:', e.message)}"

    Write-Host "[3] Corregir package.json - type commonjs y versiones fijas" -ForegroundColor Cyan
    $pkgRaw = Get-Content "$BASE\package.json" -Raw
    $pkg = $pkgRaw | ConvertFrom-Json
    $pkg.type = "commonjs"
    if ($null -eq $pkg.dependencies) { $pkg | Add-Member -Type NoteProperty -Name dependencies -Value @{} }
    $pkg.dependencies.fastify = "4.29.1"
    $pkg.dependencies.'@fastify/websocket' = "8.3.1"
    $pkg | ConvertTo-Json -Depth 10 | Set-Content "$BASE\package.json" -Encoding utf8NoBOM
    Write-Host "package.json type=commonjs, fastify 4.29.1, websocket 8.3.1" -ForegroundColor Green

    Write-Host "[4] Reescribir server.js desde cero - con safeRequire" -ForegroundColor Cyan
    $serverJs = @'
const path = require('path');
const Fastify = require('fastify');
function safeRequire(p) { const m = require(p); return m.default || m; }
const cors = safeRequire('@fastify/cors');
const websocket = safeRequire('@fastify/websocket');
const statik = safeRequire('@fastify/static');
const gpsRoutes = safeRequire('./gps_router');
const wsBroadcast = safeRequire('./ws-broadcast');
const API_KEY = process.env.API_KEY || '';
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
async function build() {
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);
  fastify.addHook('onRequest', async (req, reply) => {
    const url = req.url || '';
    if (url.startsWith('/api/')) {
      const key = req.headers['x-api-key'];
      if (API_KEY && key !== API_KEY) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return; }
    }
  });
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket || connection;
    try { wsBroadcast.addSocket(socket); } catch (e) {}
    try { socket.send(JSON.stringify({ type: 'hello', msg: 'conectado a NEXUS-SENTINEL' })); } catch (e) {}
    socket.on('close', () => { try { wsBroadcast.removeSocket(socket); } catch (e) {} });
    socket.on('error', () => { try { wsBroadcast.removeSocket(socket); } catch (e) {} });
  });
  fastify.get('/api/ble/status', async () => { return { ok: true, status: 'no-ble', msg: 'stub para silenciar 404 del frontend' }; });
  fastify.get('/health', async () => { return { ok: true, service: 'NEXUS-SENTINEL' }; });
  if (typeof gpsRoutes === 'function') { await fastify.register(gpsRoutes); } else { fastify.log.error('gps_router no es funcion, tipo: ' + typeof gpsRoutes); }
  await fastify.register(statik, { root: path.join(__dirname, 'public'), prefix: '/' });
  return fastify;
}
async function main() {
  const fastify = await build();
  try { await fastify.listen({ port: PORT, host: HOST }); } catch (err) { fastify.log.error(err); process.exit(1); }
}
if (require.main === module) { main(); }
module.exports = { build };
'@
    Set-Content -Path "$BASE\server.js" -Value $serverJs -Encoding utf8NoBOM

    Write-Host "[5] Validacion pre-PM2" -ForegroundColor Cyan
    node --check "$BASE\server.js"
    if ($LASTEXITCODE -ne 0) { throw "server.js tiene error de sintaxis" }
    Write-Host "server.js sintaxis OK" -ForegroundColor Green
    node --check "$BASE\gps_router.js"
    if ($LASTEXITCODE -ne 0) { throw "gps_router.js tiene error de sintaxis" }
    Write-Host "gps_router.js sintaxis OK" -ForegroundColor Green
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron" }

    Write-Host "[6] Reinicio PM2 y verificacion" -ForegroundColor Cyan
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $st = pm2 status
    $linea = $st | Select-String -Pattern "anduril-hubble"
    if ($linea -notmatch "online") {
        pm2 logs anduril-hubble --lines 20 --nostream
        throw "PM2 no esta online"
    }
    Write-Host "PM2 online OK" -ForegroundColor Green

    $rHealth = Invoke-RestMethod -Uri "http://127.0.0.1:3100/health" -TimeoutSec 5
    Write-Host ("health: " + $rHealth.ok) -ForegroundColor Green
    $rBle = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/ble/status" -TimeoutSec 5
    Write-Host ("ble status: " + $rBle.status) -ForegroundColor Green
    $envLines = Get-Content "$BASE\.env" -ErrorAction SilentlyContinue
    $lineKey = $envLines | Where-Object { $_ -match "API_KEY" } | Select-Object -First 1
    if ($lineKey) {
        $apiKey = ($lineKey -split "=", 2)[1].Trim()
        $body = '{"device":"test-rescate-1","lat":25.5446,"lon":-103.5331,"rssi":-80}'
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/gps/update" -Method Post -ContentType "application/json" -Headers @{ "x-api-key" = $apiKey } -Body $body -TimeoutSec 5
        Write-Host ("POST gps/update OK id: " + $res.id) -ForegroundColor Green
        $hist = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/posiciones/history?device=test-rescate-1&limit=5" -Headers @{ "x-api-key" = $apiKey } -TimeoutSec 5
        Write-Host ("Historial devuelto: " + $hist.Count + " puntos") -ForegroundColor Green
    } else {
        Write-Host "No se encontro API_KEY en .env, se omitio prueba POST" -ForegroundColor Yellow
    }

    $codigo = "Backend rescatado - abre http://127.0.0.1:3100/fleet.html y verifica que ya no hay 404 de ble/status"
    Set-Clipboard -Value $codigo
    Write-Host "OK - Backend rescatado y funcional" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}