# rf-boot-anduril.ps1 - RUNEFORGE V2 - Bootea ANDURIL HUBBLE V6
Write-Host "⚔️ RUNEFORGE V2 - Booting ANDURIL HUBBLE V6" -ForegroundColor Cyan

$core = "C:\RUNEFORGE_V2_CORE"
$anduril = Join-Path $core "anduril-hubble"

if(Test-Path $anduril){
  Write-Host "→ Iniciando ANDURIL HUBBLE en $anduril :3100" -ForegroundColor Cyan
  # Usa PM2 si está instalado, si no node directo
  $hasPm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  if($hasPm2){
    Set-Location $anduril
    pm2 delete anduril-hubble 2>$null
    pm2 start server/server.js --name anduril-hubble
    pm2 logs anduril-hubble --lines 20
  }else{
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$anduril'; npm run dev"
  }
}else{
  Write-Host "ANDURIL no encontrado en $anduril" -ForegroundColor Red
}

Write-Host "✅ Anduril: http://localhost:3100/fleet.html" -ForegroundColor Green
# Inyecta al portapapeles
Set-Clipboard -Value "http://localhost:3100/fleet.html"
Write-Host "[OK] URL copiada al portapapeles (Ctrl+V)" -ForegroundColor DarkGray
