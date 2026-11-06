(function() {
  if (window.NEXUS_WS) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws');
  window.NEXUS_WS = ws;
  window.NEXUS_WS_MSG = 0;
  ws.onopen = function() { console.log('[NEXUS] WS conectado'); };
  ws.onclose = function() {
    console.log('[NEXUS] WS cerrado, reintentando en 2s');
    setTimeout(function() { window.NEXUS_WS = null; location.reload(); }, 2000);
  };
  ws.onmessage = function(ev) {
    try {
      const data = JSON.parse(ev.data);
      window.NEXUS_WS_MSG++;
      window.NEXUS_LAST = data;
      console.log('[NEXUS] WS', data.type, data);
      if (data.type === 'posicion' && window.NEXUS_onPosicion) window.NEXUS_onPosicion(data);
      if (data.type === 'geocerca' && window.NEXUS_onGeocerca) window.NEXUS_onGeocerca(data);
      if (data.type === 'geocerca' && data.eventos) {
        data.eventos.forEach(function(e) {
          if (window.NEXUS_onGeocerca) return;
          console.log('[GEOCERCA] ' + e.deviceId + ' ' + e.tipo + ' ' + e.nombre);
        });
      }
    } catch (e) { console.log('[NEXUS] WS mensaje no JSON', ev.data); }
  };
  ws.onerror = function(e) { console.log('[NEXUS] WS error', e); };
})();
