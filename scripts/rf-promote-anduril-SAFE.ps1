# rf-promote-anduril-SAFE.ps1 - Promueve de cuarentena a canónica con validación
param([switch]$WhatIf)

$core = "C:\RUNEFORGE_V2_CORE"
$srcBase = Join-Path $core "QUARANTINE_ANDURIL\Anduril-Hubble-recursos-meta-ai"
$dstBase = Join-Path $core "anduril-hubble"

Write-Host "🔍 Validando archivos..." -ForegroundColor Yellow

$files = @(
  @{src="public\fleet.html"; dst="public\fleet.html"},
  @{src="server\server.js"; dst="server\server.js"},
  @{src="package.json"; dst="package.json"}
)

foreach($f in $files){
  $src = Join-Path $srcBase $f.src
  $dst = Join-Path $dstBase $f.dst
  if(Test-Path $src){
    if($WhatIf){
      Write-Host "[WhatIf] Copiaría $src -> $dst" -ForegroundColor Cyan
    }else{
      Copy-Item $src $dst -Force
      Write-Host "✅ Promovido $src -> $dst" -ForegroundColor Green
    }
  }else{
    Write-Host "⚠️ No existe $src, salto" -ForegroundColor DarkGray
  }
}

if(-not $WhatIf){
  Set-Location $dstBase
  git status
  Write-Host "Revisa con git status y luego git add/commit/push manual" -ForegroundColor Yellow
}
