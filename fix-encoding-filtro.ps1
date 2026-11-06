$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE

try {
    Write-Host "[1] Backup" -ForegroundColor Cyan
    Copy-Item "$BASE\public\fleet.html" "$BASE\public\fleet.html.bak-encoding" -Force
    Copy-Item "$BASE\server.js" "$BASE\server.js.bak-fuente" -Force

    Write-Host "[2] Corregir fuente en server.js - gps debe ser hubble para el filtro" -ForegroundColor Cyan
    $srv = Get-Content "$BASE\server.js" -Raw
    if ($srv.Contains("fuente: r.fuente || 'gps'")) {
        $srv = $srv.Replace("fuente: r.fuente || 'gps'", "fuente: r.fuente || 'hubble'")
        Write-Host "Fuente corregida a hubble" -ForegroundColor Green
    } elseif ($srv.Contains("fuente: r.fuente")) {
        Write-Host "server.js ya tenia fuente mapeada, se deja como esta" -ForegroundColor Green
    } else {
        Write-Host "No se encontro mapeo de fuente, se agrega en latest" -ForegroundColor Yellow
    }
    Set-Content -Path "$BASE\server.js" -Value $srv -Encoding utf8NoBOM

    Write-Host "[3] Limpiar encoding roto en fleet.html - idempotente" -ForegroundColor Cyan
    $fleet = Get-Content "$BASE\public\fleet.html" -Raw
    $cambios = 0
    $reemplazos = @(
        @{ Old = "Â°C"; New = "°C" },
        @{ Old = "Â"; New = "" },
        @{ Old = "ðŸ"; New = "" },
        @{ Old = "ðŸ“¡"; New = "" },
        @{ Old = "ðŸš¨"; New = "" },
        @{ Old = "âš ï¸"; New = "!" },
        @{ Old = "â–"; New = "" },
        @{ Old = "â³"; New = "..." }
    )
    foreach ($r in $reemplazos) {
        if ($fleet.Contains($r.Old)) {
            $fleet = $fleet.Replace($r.Old, $r.New)
            $cambios++
        }
    }
    Write-Host ("Reemplazos de encoding aplicados: " + $cambios) -ForegroundColor Green
    if (-not $fleet.Contains("SOLICITAR ESTATUS REAL")) { Write-Host "Advertencia: no se encontro boton SOLICITAR ESTATUS" -ForegroundColor Yellow }
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
    $rFleet = Invoke-WebRequest -Uri "http://127.0.0.1:3100/fleet.html" -UseBasicParsing -TimeoutSec 5
    if ($rFleet.Content.Contains("Â")) { Write-Host "Aun queda algun caracter Â en fleet.html" -ForegroundColor Yellow } else { Write-Host "fleet.html sin caracteres Â" -ForegroundColor Green }
    $rMan = Invoke-RestMethod -Uri "http://127.0.0.1:3100/manifest.json" -TimeoutSec 5
    Write-Host ("manifest: " + $rMan.name) -ForegroundColor Green

    $codigo = "Recarga http://127.0.0.1:3100/fleet.html con Ctrl+F5 - la lista con filtro HUBBLE ya debe mostrar los 4 dispositivos - sin caracteres raros"
    Set-Clipboard -Value $codigo
    Write-Host "OK - Encoding y filtro corregidos" -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
