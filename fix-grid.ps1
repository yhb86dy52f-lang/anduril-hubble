$B = "C:\RUNEFORGE_V2_CORE\services\anduril-hubble"
Set-Location $B
$ErrorActionPreference = 'Stop'

try {
    Write-Host "[1] Restaurando backup seguro..." -ForegroundColor Cyan
    $bak = "$B\public\fleet.html.bak-grid"
    if (Test-Path $bak) {
        Copy-Item $bak "$B\public\fleet.html" -Force
    } else {
        Write-Host "   [!] No se encontró el backup .bak-grid. Usando el archivo actual." -ForegroundColor Yellow
    }

    $p = "$B\public\fleet.html"
    $c = Get-Content $p -Raw

    Write-Host "[2] Inyectando CSS del Data Grid..." -ForegroundColor Cyan
    $css = @"
/* VISTA DE FLOTA (DATA GRID) */
#fleet-grid-view { display: none; flex: 1; background: var(--bg); overflow: auto; padding: 20px; flex-direction: column; }
#fleet-grid-view.active { display: flex; }
.fleet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fleet-table th { background: var(--bg2); color: var(--muted); padding: 12px 16px; text-align: left; font-size: 11px; letter-spacing: .5px; border-bottom: 1px solid var(--line); position: sticky; top: 0; }
.fleet-table td { padding: 12px 16px; border-bottom: 1px solid var(--line); color: var(--txt); font-family: "JetBrains Mono", monospace; }
.fleet-table tr:hover td { background: rgba(168, 85, 247, .06); }
.btn-row { padding: 6px 12px; background: var(--bg2); border: 1px solid var(--line2); color: var(--txt); border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
.btn-row:hover { border-color: var(--purple); color: var(--purple); }
"@
    $c = $c.Replace("</style>", $css + "</style>")

    Write-Host "[3] Inyectando HTML del Data Grid (Anclaje Seguro)..." -ForegroundColor Cyan
    $grid = @"
<!-- VISTA DE FLOTA (DATA GRID) -->
<div id="fleet-grid-view">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h2 style="font-size:18px">FLOTA // TODOS LOS DISPOSITIVOS</h2>
    <button class="btn-row" onclick="loadPositions();renderFleetTable()">Actualizar Tabla</button>
  </div>
  <table class="fleet-table">
    <thead>
      <tr>
        <th>Estado</th>
        <th>Dispositivo</th>
        <th>Fuente</th>
        <th>Latitud / Longitud</th>
        <th>RSSI</th>
        <th>Velocidad</th>
        <th>Temp</th>
        <th>Última Actualización</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody id="fleet-grid-body"></tbody>
  </table>
</div>
"@
    $anchor = '<footer class="timeslider"'
    if ($c.Contains($anchor)) {
        $c = $c.Replace($anchor, $grid + "`n  " + $anchor)
    } else {
        throw "No se encontró el footer del Time Slider. La inyección falló."
    }

    Write-Host "[4] Inyectando lógica JS del Data Grid..." -ForegroundColor Cyan
    $js = @"
// --- LÓGICA VISTA DE FLOTA (DATA GRID) ---
function showMapView() {
    var g = document.getElementById('fleet-grid-view');
    if(g) g.classList.remove('active');
    var s = document.querySelector('.sidebar');
    if(s) s.style.display = 'flex';
    var m = document.querySelector('.map-wrap');
    if(m) m.style.display = 'flex';
    var b1 = document.getElementById('btn-map-view');
    if(b1) b1.classList.add('active');
    var b2 = document.getElementById('btn-list-view');
    if(b2) b2.classList.remove('active');
    var ip = document.getElementById('info-panel');
    if(ip) ip.classList.remove('open');
    if(window.NEXUS_MAP) window.NEXUS_MAP.invalidateSize();
}

function showFleetView() {
    var g = document.getElementById('fleet-grid-view');
    if(g) g.classList.add('active');
    var s = document.querySelector('.sidebar');
    if(s) s.style.display = 'none';
    var m = document.querySelector('.map-wrap');
    if(m) m.style.display = 'none';
    var b1 = document.getElementById('btn-map-view');
    if(b1) b1.classList.remove('active');
    var b2 = document.getElementById('btn-list-view');
    if(b2) b2.classList.add('active');
    var ip = document.getElementById('info-panel');
    if(ip) ip.classList.remove('open');
    renderFleetTable();
}

function renderFleetTable() {
    var tb = document.getElementById('fleet-grid-body');
    if(!tb) return;
    
    if(!window.allPositions || !allPositions.length) {
        tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No hay dispositivos en la flota.</td></tr>';
        return;
    }

    var html = '';
    for(var i = 0; i < allPositions.length; i++) {
        var p = allPositions[i];
        var id = p.dispositivo_id || p.mid || '';
        var isOn = false;
        try { isOn = ((new Date() - new Date(p.timestamp))/1000/60) < 15; } catch(e) {}
        var rssi = p.rssi != null ? p.rssi : -100;
        var pct = Math.max(0, Math.min(100, ((rssi + 120) / 50) * 100));
        var col = rssi < -90 ? 'var(--red)' : rssi < -75 ? 'var(--amber)' : 'var(--green)';
        var temp = p.temperatura != null ? p.temperatura : '--';
        
        html += '<tr>';
        html += '<td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (isOn?'var(--green)':'var(--muted2)') + '"></span> ' + (isOn?'ONLINE':'OFFLINE') + '</td>';
        html += '<td><b style="color:var(--cyan)">' + (p.nombre || id) + '</b><br><small style="color:var(--muted)">' + id + '</small></td>';
        html += '<td>' + String(p.fuente || 'sms').toUpperCase() + '</td>';
        html += '<td>' + Number(p.lat).toFixed(6) + ', ' + Number(p.lon).toFixed(6) + '</td>';
        html += '<td><div style="height:4px;background:#333;width:60px;display:inline-block;vertical-align:middle;margin-right:8px"><div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div> ' + rssi + ' dBm</td>';
        html += '<td>' + (p.velocidad || 0) + ' km/h</td>';
        html += '<td>' + temp + ' &deg;C</td>';
        html += '<td>' + new Date(p.timestamp).toLocaleString('es-MX') + '</td>';
        html += '<td><button class="btn-row" onclick="showMapView();focusDevice(\'' + id + '\')">Ver en Mapa</button></td>';
        html += '</tr>';
    }
    tb.innerHTML = html;
}
// -----------------------------------------
"@
    $c = $c.Replace("</body>", "<script>" + $js + "</script></body>")

    Write-Host "[5] Corrigiendo botón FLOTA..." -ForegroundColor Cyan
    $c = $c.Replace('onclick="toggleSidebarMobile()">FLOTA', 'onclick="showFleetView()">FLOTA')

    Write-Host "[6] Validando sintaxis del HTML..." -ForegroundColor Cyan
    if (-not $c.Contains("fleet-grid-view")) { throw "Error: no se inyectó el HTML del grid." }
    if (-not $c.Contains("function showFleetView()")) { throw "Error: no se inyectó la lógica JS." }
    if ($c.Contains("`${isOn")) { throw "Error: JavaScript con template corrupto." }

    Set-Content -Path $p -Value $c -Encoding utf8NoBOM
    Write-Host "   [OK] Archivo guardado." -ForegroundColor Green

    Write-Host "[7] Validando tests y reiniciando PM2..." -ForegroundColor Cyan
    node --test test/gps.test.cjs test/geofence.test.cjs
    if ($LASTEXITCODE -ne 0) { throw "Tests fallaron." }
    
    pm2 restart anduril-hubble --update-env
    Start-Sleep -Seconds 3
    $r = Invoke-WebRequest "http://127.0.0.1:3100/fleet.html" -UseBasicParsing
    if (-not $r.Content.Contains("fleet-grid-view")) { throw "El servidor no está sirviendo el grid." }

    Write-Host "`n[OK] DATA GRID REPARADO E INSTALADO CORRECTAMENTE." -ForegroundColor Green
    Write-Host "Abriendo navegador..." -ForegroundColor Magenta
    Start-Process "http://127.0.0.1:3100/fleet.html"

} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
