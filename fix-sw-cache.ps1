$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
$ErrorActionPreference = 'Stop'
Set-Location $BASE
try {
    Write-Host "[1] Backup sw.js" -ForegroundColor Cyan
    Copy-Item "$BASE\public\sw.js" "$BASE\public\sw.js.bak-v2" -Force
    $sw = Get-Content "$BASE\public\sw.js" -Raw
    if ($sw.Contains("nexus-sentinel-v1")) {
        $sw = $sw.Replace("nexus-sentinel-v1", "nexus-sentinel-v2")
        Write-Host "[OK] Cache subido a v2" -ForegroundColor Green
    } elseif ($sw.Contains("nexus-sentinel-v2")) {
        $sw = $sw.Replace("nexus-sentinel-v2", "nexus-sentinel-v3")
        Write-Host "[OK] Cache subido a v3" -ForegroundColor Green
    } else {
        Write-Host "[!] No encontre version de cache, se deja como esta" -ForegroundColor Yellow
    }
    Set-Content -Path "$BASE\public\sw.js" -Value $sw -Encoding utf8NoBOM
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3100/sw.js" -UseBasicParsing -TimeoutSec 5
    if ($r.Content.Contains("nexus-sentinel-v2") -or $r.Content.Contains("nexus-sentinel-v3")) { Write-Host "[OK] Servidor ya sirve sw.js nuevo" -ForegroundColor Green }
    Write-Host "Listo. Ahora limpia el SW en el navegador." -ForegroundColor Magenta
} catch { Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red; exit 1 }