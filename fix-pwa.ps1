$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE

try {
    Write-Host "[1] Rutas canonicas" -ForegroundColor Cyan
    $PUBLIC = "$BASE\public"
    $MANIFEST = "$PUBLIC\manifest.json"
    $SW = "$PUBLIC\sw.js"
    $FLEET = "$PUBLIC\fleet.html"

    Write-Host "[2] Backup .bak" -ForegroundColor Cyan
    if (Test-Path $MANIFEST) { Copy-Item $MANIFEST "$MANIFEST.bak" -Force }
    if (Test-Path $SW) { Copy-Item $SW "$SW.bak" -Force }
    if (Test-Path $FLEET) { Copy-Item $FLEET "$FLEET.bak" -Force }

    Write-Host "[3] Crear manifest.json desde cero" -ForegroundColor Cyan
    $manifestJson = @'
{
  "name": "NEXUS-SENTINEL // Anduril Hubble",
  "short_name": "NEXUS",
  "description": "Centro de mando tactico de rastreo - NEXUS-SENTINEL",
  "start_url": "/fleet.html",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#080312",
  "theme_color": "#a855f7",
  "lang": "es",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
'@
    Set-Content -Path $MANIFEST -Value $manifestJson -Encoding utf8NoBOM

    Write-Host "[4] Crear sw.js desde cero" -ForegroundColor Cyan
    $swJs = @'
const CACHE = 'nexus-sentinel-v1';
const CORE = ['/fleet.html', '/manifest.json', '/ws-client.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE ? caches.delete(k) : null))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match('/fleet.html'))));
});
'@
    Set-Content -Path $SW -Value $swJs -Encoding utf8NoBOM

    Write-Host "[5] Crear iconos placeholder PNG sin SVG" -ForegroundColor Cyan
    if (-not (Test-Path "$PUBLIC\icons")) { New-Item -ItemType Directory -Path "$PUBLIC\icons" -Force | Out-Null }
    $pngB64 = "[STRIPPED 92 bytes]"
    $pngBytes = [Convert]::FromBase64String($pngB64)
    [IO.File]::WriteAllBytes("$PUBLIC\icons\icon-192.png", $pngBytes)
    [IO.File]::WriteAllBytes("$PUBLIC\icons\icon-512.png", $pngBytes)
    Write-Host "Iconos placeholder creados. Reemplazalos luego con tus PNG reales de 192 y 512 con el mismo nombre." -ForegroundColor Yellow

    Write-Host "[6] Inyectar manifest y SW en fleet.html con Replace exacto - idempotente" -ForegroundColor Cyan
    $fleetTexto = Get-Content $FLEET -Raw
    if (-not $fleetTexto.Contains("manifest.json")) {
        $headInject = @'
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#a855f7">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
</head>
'@
        $fleetTexto = $fleetTexto.Replace("</head>", $headInject)
        Write-Host "Manifest inyectado" -ForegroundColor Green
    } else {
        Write-Host "fleet.html ya tenia manifest.json - no se duplica" -ForegroundColor Green
    }
    if (-not $fleetTexto.Contains("serviceWorker")) {
        $swRegister = @'
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
          console.log('[PWA] SW registrado', reg.scope);
        }).catch(function(err) {
          console.log('[PWA] SW fallo', err);
        });
      });
    }
  </script>
</body>
'@
        $fleetTexto = $fleetTexto.Replace("</body>", $swRegister)
        Write-Host "Registro SW inyectado" -ForegroundColor Green
    } else {
        Write-Host "fleet.html ya tenia serviceWorker - no se duplica" -ForegroundColor Green
    }
    Set-Content -Path $FLEET -Value $fleetTexto -Encoding utf8NoBOM

    Write-Host "[7] Validacion pre-PM2 - si falla, aborta" -ForegroundColor Cyan
    $manifestRaw = Get-Content $MANIFEST -Raw
    $manifestRaw | Test-Json -ErrorAction Stop
    Write-Host "manifest.json JSON valido" -ForegroundColor Green
    node --check $SW
    if ($LASTEXITCODE -ne 0) { throw "sw.js tiene error de sintaxis" }
    Write-Host "sw.js sintaxis OK" -ForegroundColor Green
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron" }

    Write-Host "[8] Reinicio PM2 y verificacion con Invoke-RestMethod" -ForegroundColor Cyan
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $st = pm2 status
    $linea = $st | Select-String -Pattern "anduril-hubble"
    if ($linea -notmatch "online") { throw "PM2 no esta online" }
    Write-Host "PM2 online OK" -ForegroundColor Green

    $r1 = Invoke-RestMethod -Uri "http://127.0.0.1:3100/manifest.json" -TimeoutSec 5
    Write-Host ("manifest.json responde: " + $r1.name) -ForegroundColor Green
    $r2 = Invoke-WebRequest -Uri "http://127.0.0.1:3100/sw.js" -UseBasicParsing -TimeoutSec 5
    Write-Host ("sw.js responde status: " + $r2.StatusCode) -ForegroundColor Green
    $r3 = Invoke-WebRequest -Uri "http://127.0.0.1:3100/fleet.html" -UseBasicParsing -TimeoutSec 5
    if ($r3.Content.Contains("manifest.json") -and $r3.Content.Contains("serviceWorker")) {
        Write-Host "fleet.html ya sirve manifest y SW" -ForegroundColor Green
    } else {
        throw "fleet.html no sirve manifest o SW"
    }

    Write-Host "[9] Clipboard automatico" -ForegroundColor Cyan
    $codigo = "Abre en tu celular http://TU-IP:3100/fleet.html - Menu Chrome - Agregar a pantalla principal - Debe aparecer como NEXUS. Luego activa Modo avion y recarga, debe abrir desde cache."
    Set-Clipboard -Value $codigo
    Write-Host "Instruccion copiada al portapapeles - haz Ctrl+V" -ForegroundColor Magenta
    Write-Host "OK - PWA funcional" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}