const test = require('node:test');
const assert = require('node:assert');
const { pointInPolygon, checkGeofences } = require('../geofence.js');

const casa = [[-103.5380, 25.5490], [-103.5280, 25.5490], [-103.5280, 25.5400], [-103.5380, 25.5400], [-103.5380, 25.5490]];

test('Debe detectar dentro de casa - Torreon', () => {
  assert.strictEqual(pointInPolygon(25.5446, -103.5331, casa), true);
});

test('Debe detectar fuera de casa', () => {
  assert.strictEqual(pointInPolygon(25.6000, -103.6000, casa), false);
});

test('Debe disparar evento entro al cruzar', () => {
  const device = 'test-entrar-' + Date.now();
  let ev = checkGeofences(device, 25.6000, -103.6000);
  assert.strictEqual(ev.length, 0);
  ev = checkGeofences(device, 25.5446, -103.5331);
  assert.strictEqual(ev.length, 1);
  assert.strictEqual(ev[0].tipo, 'entro');
  assert.strictEqual(ev[0].geofence, 'casa');
});

test('Debe disparar evento salio al salir', () => {
  const device = 'test-salir-' + Date.now();
  checkGeofences(device, 25.5446, -103.5331);
  const ev = checkGeofences(device, 25.6000, -103.6000);
  assert.strictEqual(ev.length, 1);
  assert.strictEqual(ev[0].tipo, 'salio');
});
