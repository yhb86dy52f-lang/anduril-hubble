const sockets = new Set();
function addSocket(ws) { sockets.add(ws); }
function removeSocket(ws) { sockets.delete(ws); }
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of sockets) {
    try { if (ws.readyState === 1) ws.send(msg); } catch (e) {}
  }
}
module.exports = { addSocket, removeSocket, broadcast, sockets };
