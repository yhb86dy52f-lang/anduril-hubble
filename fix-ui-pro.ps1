$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE
try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\public\fleet.html" "$BASE\public\fleet.html.bak-ui-pro" -Force
    $nuevo = "$BASE\public\fleet_v2_profesional.html"
    if (-not (Test-Path $nuevo)) { throw "No existe fleet_v2_profesional.html en public. Descargalo ahi primero." }
    Write-Host "[2] Reemplazar fleet.html por version profesional" -ForegroundColor Cyan
    Copy-Item $nuevo "$BASE\public\fleet.html" -Force
    Write-Host "[3] Validacion" -ForegroundColor Cyan
    $texto = Get-Content "$BASE\public\fleet.html" -Raw
    if ($texto.Contains([string][char]0x00C2)) { throw "Aun queda caracter Â" }
    if (-not $texto.Contains("SOLICITAR ESTATUS REAL")) { throw "Falta boton SOLICITAR ESTATUS" }
    if (-not $texto.Contains("device-list")) { throw "Falta device-list" }
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron" }
    Write-Host "[4] Reinicio PM2" -ForegroundColor Cyan
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $st = pm2 status
    if (($st | Select-String -Pattern "anduril-hubble") -notmatch "online") { throw "PM2 no esta online" }
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3100/fleet.html" -UseBasicParsing -TimeoutSec 5
    if (-not $r.Content.Contains("ANDURIL HUBBLE")) { throw "fleet.html no sirve nueva version" }
    Write-Host "OK - Interfaz profesional instalada" -ForegroundColor Green
    Set-Clipboard -Value "Recarga http://127.0.0.1:3100/fleet.html con Ctrl+F5 - interfaz profesional"
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}