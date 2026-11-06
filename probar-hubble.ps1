$BASE = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
Set-Location $BASE
$envLines = Get-Content "$BASE\.env"
$lineKey = $envLines | Where-Object { $_ -match "^API_KEY=" } | Select-Object -First 1
$apiKey = ($lineKey -split "=", 2)[1].Trim()
$headers = @{ "x-api-key" = $apiKey; "Content-Type" = "application/json" }
$body = @{ device = "test-hubble-1"; lat = 25.5446; lon = -103.5331; rssi = -80 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/gps/update" -Method POST -Headers $headers -Body $body -TimeoutSec 5
Write-Host "POST hubble OK - recarga fleet.html con Ctrl+F5 y pon filtro HUBBLE"