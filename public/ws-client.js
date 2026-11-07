(function() {
  if (window.NEXUS_WS) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws');
  window.NEXUS_WS = ws;
  ws.onopen = function() { console.log('[NEXUS] WS conectado'); };
  ws.onmessage = function(ev) { try { const data = JSON.parse(ev.data); if(data.type==='posicion' && window.NEXUS_onPosicion) window.NEXUS_onPosicion(data); } catch(e){} };
})();