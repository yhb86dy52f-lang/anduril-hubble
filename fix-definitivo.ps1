$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE
try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\public\fleet.html" "$BASE\public\fleet.html.bak-definitivo" -Force
    Copy-Item "$BASE\public\sw.js" "$BASE\public\sw.js.bak-definitivo" -Force
    Copy-Item "$BASE\public\manifest.json" "$BASE\public\manifest.json.bak-definitivo" -Force

    Write-Host "[2] Fijar fleet.html = version profesional" -ForegroundColor Cyan
    $origen = "$BASE\public\fleet_v2_profesional.html"
    if (-not (Test-Path $origen)) { throw "No existe fleet_v2_profesional.html en public" }
    $nuevo = Get-Content $origen -Raw
    $actual = Get-Content "$BASE\public\fleet.html" -Raw
    if ($actual.Contains("CENTRO DE MANDO")) { Write-Host "[OK] fleet.html ya es profesional, se deja" -ForegroundColor Green }
    else { Copy-Item $origen "$BASE\public\fleet.html" -Force; Write-Host "[OK] fleet.html reemplazado por profesional" -ForegroundColor Green }

    Write-Host "[3] Reescribir sw.js definitivo - network-first para fleet.html" -ForegroundColor Cyan
    $swNuevo = @'
const CACHE = 'nexus-sentinel-v3';
const CORE = ['/fleet.html','/manifest.json','/ws-client.js','/time-slider.js'];
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).catch(function(){}));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf('/api/') === 0 || url.pathname === '/fleet.html' || url.pathname === '/fleet_v2_profesional.html') {
    e.respondWith(fetch(e.request).then(function(r){
      var copy = r.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return r;
    }).catch(function(){ return caches.match(e.request); }));
  } else {
    e.respondWith(caches.match(e.request).then(function(hit){ return hit || fetch(e.request); }));
  }
});
'@
    Set-Content -Path "$BASE\public\sw.js" -Value $swNuevo -Encoding utf8NoBOM
    Write-Host "[OK] sw.js reescrito a v3 con network-first" -ForegroundColor Green

    Write-Host "[4] Fijar manifest - start_url a fleet.html nueva" -ForegroundColor Cyan
    $man = Get-Content "$BASE\public\manifest.json" -Raw
    if ($man.Contains("fleet_v2")) { $man = $man.Replace("fleet_v2_profesional.html", "fleet.html"); Set-Content -Path "$BASE\public\manifest.json" -Value $man -Encoding utf8NoBOM; Write-Host "[OK] manifest start_url a fleet.html" -ForegroundColor Green }
    else { Write-Host "[OK] manifest ya apunta a fleet.html" -ForegroundColor Green }

    Write-Host "[5] Validacion" -ForegroundColor Cyan
    $f = Get-Content "$BASE\public\fleet.html" -Raw
    if (-not $f.Contains("CENTRO DE MANDO")) { throw "fleet.html no tiene CENTRO DE MANDO" }
    if (-not $f.Contains("UBICACION EN VIVO")) { throw "fleet.html no tiene UBICACION EN VIVO" }
    if ($f.Contains([string][char]0x00C2)) { throw "fleet.html aun tiene Â" }
    $s = Get-Content "$BASE\public\sw.js" -Raw
    if (-not $s.Contains("nexus-sentinel-v3")) { throw "sw.js no quedo en v3" }
    if (-not $s.Contains("network-first")) { throw "sw.js no tiene network-first - se pierde el fix" }
    node --check "$BASE\server.js"
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron" }
    Write-Host "[OK] Tests 8/8" -ForegroundColor Green

    Write-Host "[6] Reinicio PM2 y verificacion del servidor" -ForegroundColor Cyan
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $rFleet = Invoke-WebRequest -Uri "http://127.0.0.1:3100/fleet.html" -UseBasicParsing -TimeoutSec 5
    if (-not $rFleet.Content.Contains("CENTRO DE MANDO")) { throw "Servidor sigue sirviendo viejo" }
    $rSw = Invoke-WebRequest -Uri "http://127.0.0.1:3100/sw.js" -UseBasicParsing -TimeoutSec 5
    if (-not $rSw.Content.Contains("nexus-sentinel-v3")) { throw "Servidor sigue sirviendo sw.js viejo" }
    Write-Host "[OK] Servidor sirve fleet.html nueva + sw.js v3" -ForegroundColor Green
    Set-Clipboard -Value "Abre http://127.0.0.1:3100/fleet.html en incognito - debe salir CENTRO DE MANDO"
    Write-Host "OK - FIJADO PERFECTAMENTE" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}