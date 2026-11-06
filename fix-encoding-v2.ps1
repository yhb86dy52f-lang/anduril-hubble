$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE

try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\public\fleet.html" "$BASE\public\fleet.html.bak-enc2" -Force
    Copy-Item "$BASE\server.js" "$BASE\server.js.bak-enc2" -Force

    Write-Host "[2] Corregir fuente en server.js" -ForegroundColor Cyan
    $srv = Get-Content "$BASE\server.js" -Raw
    if ($srv.Contains("fuente: r.fuente || 'gps'")) {
        $srv = $srv.Replace("fuente: r.fuente || 'gps'", "fuente: r.fuente || 'hubble'")
        Write-Host "Fuente corregida a hubble" -ForegroundColor Green
    } else {
        Write-Host "server.js ya tenia fuente hubble o no usa ese mapeo" -ForegroundColor Green
    }
    Set-Content -Path "$BASE\server.js" -Value $srv -Encoding utf8NoBOM

    Write-Host "[3] Limpiar encoding con codigos char - sin pegar caracteres raros" -ForegroundColor Cyan
    $fleet = Get-Content "$BASE\public\fleet.html" -Raw
    $cA = [char]0x00C2
    $cE = [char]0x00B0
    $fleet = $fleet.Replace($cA, "")
    $fleet = $fleet.Replace([char]0x00F0, "")
    $fleet = $fleet.Replace([char]0x009F, "")
    $fleet = $fleet.Replace("TEMP: ", "TEMP: ")
    Write-Host "Caracteres Â y controles eliminados" -ForegroundColor Green
    if ($fleet.Contains("SOLICITAR ESTATUS REAL")) { Write-Host "Boton SOLICITAR ESTATUS encontrado" -ForegroundColor Green }
    Set-Content -Path "$BASE\public\fleet.html" -Value $fleet -Encoding utf8NoBOM

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
    $rMan = Invoke-RestMethod -Uri "http://127.0.0.1:3100/manifest.json" -TimeoutSec 5
    Write-Host ("manifest: " + $rMan.name) -ForegroundColor Green
    $rFleet = Invoke-WebRequest -Uri "http://127.0.0.1:3100/fleet.html" -UseBasicParsing -TimeoutSec 5
    if ($rFleet.Content.Contains([char]0x00C2)) { Write-Host "Aun queda Â en fleet.html" -ForegroundColor Yellow } else { Write-Host "fleet.html limpio de Â" -ForegroundColor Green }

    $codigo = "Recarga http://127.0.0.1:3100/fleet.html con Ctrl+F5 - lista HUBBLE debe mostrar 4 dispositivos"
    Set-Clipboard -Value $codigo
    Write-Host "OK - Encoding y filtro corregidos" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}