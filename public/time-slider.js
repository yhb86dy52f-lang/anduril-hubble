(function() {
  if (window.NEXUS_TIME_SLIDER) return;
  window.NEXUS_TIME_SLIDER = true;
  let history = [];
  let idx = 0;
  let playing = false;
  let timer = null;
  let timeMarker = null;

  function ensureBar() {
    if (document.getElementById('time-slider-bar')) return;
    const style = document.createElement('style');
    style.textContent = "#time-slider-bar{position:fixed;left:0;right:0;bottom:0;z-index:3000;background:rgba(18,6,36,0.96);border-top:1px solid rgba(168,85,247,0.4);padding:10px 14px;display:flex;gap:12px;align-items:center;font-family:monospace;color:#e6e2f0} #time-slider-bar input[type=range]{flex:1;accent-color:#a855f7} #time-slider-bar button{background:transparent;border:1px solid #a855f7;color:#a855f7;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:700} #time-slider-bar .ts{font-size:11px;color:#00e5ff;min-width:170px} #time-slider-bar .rssi{font-size:11px;color:#00ff88;min-width:90px}";
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'time-slider-bar';
    bar.innerHTML = '<button id="ts-play">PLAY</button><input id="ts-range" type="range" min="0" max="0" value="0"><span class="ts" id="ts-label">Sin historial</span><span class="rssi" id="ts-rssi">RSSI --</span><button id="ts-live">LIVE</button>';
    document.body.appendChild(bar);
    document.getElementById('ts-play').onclick = togglePlay;
    document.getElementById('ts-live').onclick = goLive;
    document.getElementById('ts-range').oninput = function(e) { showPoint(parseInt(e.target.value)); stopPlay(); };
  }

  function showPoint(i) {
    if (!history.length) return;
    idx = Math.max(0, Math.min(i, history.length - 1));
    const p = history[idx];
    const range = document.getElementById('ts-range');
    if (range) range.value = idx;
    const label = document.getElementById('ts-label');
    if (label) label.textContent = new Date(p.ts).toLocaleString() + ' - ' + p.deviceId;
    const rssiEl = document.getElementById('ts-rssi');
    if (rssiEl) rssiEl.textContent = 'RSSI ' + (p.rssi !== null && p.rssi !== undefined ? p.rssi + ' dBm' : '--');
    const map = window.NEXUS_MAP;
    if (map && window.L) {
      if (!timeMarker) {
        timeMarker = window.L.marker([p.lat, p.lon], { title: 'Replay' }).addTo(map);
      } else {
        timeMarker.setLatLng([p.lat, p.lon]);
      }
      map.setView([p.lat, p.lon], map.getZoom());
    }
  }

  function togglePlay() {
    if (playing) { stopPlay(); return; }
    if (!history.length) { loadHistory(); return; }
    playing = true;
    document.getElementById('ts-play').textContent = 'PAUSE';
    timer = setInterval(function() {
      idx++;
      if (idx >= history.length) { stopPlay(); return; }
      showPoint(idx);
    }, 500);
  }
  function stopPlay() {
    playing = false;
    if (timer) clearInterval(timer);
    const b = document.getElementById('ts-play');
    if (b) b.textContent = 'PLAY';
  }
  function goLive() {
    stopPlay();
    loadHistory().then(function() {
      if (history.length) showPoint(history.length - 1);
    });
  }

  async function loadHistory() {
    ensureBar();
    try {
      const r = await fetch('/api/posiciones/history?limit=500');
      const j = await r.json();
      history = Array.isArray(j) ? j : [];
      const range = document.getElementById('ts-range');
      if (range) { range.max = Math.max(0, history.length - 1); range.value = history.length ? history.length - 1 : 0; }
      const label = document.getElementById('ts-label');
      if (label) label.textContent = history.length ? history.length + ' puntos - arrastra para reproducir' : 'Sin historial - manda un POST para generar datos';
      if (history.length) showPoint(history.length - 1);
      return history;
    } catch (e) {
      const label = document.getElementById('ts-label');
      if (label) label.textContent = 'Error cargando historial';
      return [];
    }
  }

  window.NEXUS_loadHistory = loadHistory;
  window.NEXUS_showPoint = showPoint;
  document.addEventListener('DOMContentLoaded', loadHistory);
  if (document.readyState !== 'loading') loadHistory();
})();
