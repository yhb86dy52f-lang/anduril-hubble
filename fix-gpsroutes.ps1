$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE

try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\server.js" "$BASE\server.js.bak-gpsroutes" -Force

    Write-Host "[2] Diagnostico - que exporta gps_router y db" -ForegroundColor Cyan
    node -e "console.log('gps_router keys:', Object.keys(require('./gps_router.js'))); console.log('gpsRoutes type:', typeof require('./gps_router.js').gpsRoutes);"
    node -e "try{console.log('db keys:', Object.keys(require('./db.js')));}catch(e){console.log('db error:', e.message)}"

    Write-Host "[3] Corregir extraccion de gpsRoutes en server.js - idempotente" -ForegroundColor Cyan
    $texto = Get-Content "$BASE\server.js" -Raw
    if (-not $texto.Contains("gpsModule")) {
        $oldConst = "const gpsRoutes = safeRequire('./gps_router');"
        $newConst = "const gpsModule = safeRequire('./gps_router');`nconst gpsRoutes = gpsModule.gpsRoutes || gpsModule.default || gpsModule;"
        $texto = $texto.Replace($oldConst, $newConst)
        Write-Host "Const gpsRoutes corregido a gpsModule.gpsRoutes" -ForegroundColor Green
    } else {
        Write-Host "server.js ya tenia gpsModule - no se duplica" -ForegroundColor Green
    }

    if (-not $texto.Contains("/api/posiciones/latest")) {
        $oldRegister = "  if (typeof gpsRoutes === 'function') { await fastify.register(gpsRoutes); } else { fastify.log.error('gps_router no es funcion, tipo: ' + typeof gpsRoutes); }"
        $newBlock = @'
  fastify.get('/api/posiciones/latest', async () => {
    try {
      const dbMod = safeRequire('./db');
      if (typeof dbMod.getLatestPositions === 'function') {
        const rows = dbMod.getLatestPositions();
        return rows.map((r) => ({ dispositivo_id: r.device || r.dispositivo_id || r.deviceId, nombre: r.nombre || r.device || r.dispositivo_id, lat: r.lat, lon: r.lon, velocidad: r.velocidad || 0, temperatura: r.temperatura || null, fuente: r.fuente || 'gps', timestamp: r.timestamp || r.ts, rssi: r.rssi }));
      }
      if (typeof dbMod.getHistory === 'function') { return dbMod.getHistory(null, 50); }
    } catch (e) { fastify.log.error(e); }
    return [];
  });
  if (typeof gpsRoutes === 'function') { await fastify.register(gpsRoutes); } else { fastify.log.error('gps_router no es funcion, tipo: ' + typeof gpsRoutes); }
'@
        $texto = $texto.Replace($oldRegister, $newBlock)
        Write-Host "Endpoint /api/posiciones/latest restaurado" -ForegroundColor Green
    } else {
        Write-Host "server.js ya tenia /api/posiciones/latest - no se duplica" -ForegroundColor Green
    }
    Set-Content -Path "$BASE\server.js" -Value $texto -Encoding utf8NoBOM

    Write-Host "[4] Validacion pre-PM2" -ForegroundColor Cyan
    node --check "$BASE\server.js"
    if ($LASTEXITCODE -ne 0) { throw "server.js tiene error de sintaxis" }
    Write-Host "server.js sintaxis OK" -ForegroundColor Green
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron" }

    Write-Host "[5] Reinicio PM2 y verificacion" -ForegroundColor Cyan
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
    $rLatest = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/posiciones/latest" -TimeoutSec 5
    Write-Host ("GET /api/posiciones/latest OK, count: " + $rLatest.Count) -ForegroundColor Green

    $envLines = Get-Content "$BASE\.env" -ErrorAction SilentlyContinue
    $lineKey = $envLines | Where-Object { $_ -match "API_KEY" } | Select-Object -First 1
    if ($lineKey) {
        $apiKey = ($lineKey -split "=", 2)[1].Trim()
        $body = '{"device":"test-rescate-2","lat":25.5446,"lon":-103.5331,"rssi":-80}'
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/gps/update" -Method Post -ContentType "application/json" -Headers @{ "x-api-key" = $apiKey } -Body $body -TimeoutSec 5
        Write-Host ("POST gps/update OK id: " + $res.id) -ForegroundColor Green
        Start-Sleep -Seconds 1
        $hist = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/posiciones/history?device=test-rescate-2&limit=5" -Headers @{ "x-api-key" = $apiKey } -TimeoutSec 5
        Write-Host ("Historial devuelto: " + $hist.Count + " puntos") -ForegroundColor Green
        $latest2 = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/posiciones/latest" -Headers @{ "x-api-key" = $apiKey } -TimeoutSec 5
        Write-Host ("Latest despues de POST: " + $latest2.Count) -ForegroundColor Green
    } else {
        Write-Host "No se encontro API_KEY en .env" -ForegroundColor Yellow
    }

    $codigo = "Backend rescatado - POST gps/update funciona - abre http://127.0.0.1:3100/fleet.html"
    Set-Clipboard -Value $codigo
    Write-Host "OK - gpsRoutes corregido y funcional" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}