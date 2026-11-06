const test = require('node:test');
const assert = require('node:assert');
const { isValidLat, isValidLon } = require('../gps_router');

test('Debe aceptar coordenadas válidas (Torreón)', () => {
    assert.strictEqual(isValidLat(25.5446), true);
    assert.strictEqual(isValidLon(-103.5331), true);
});

test('Debe rechazar latitud falsa (999)', () => {
    assert.strictEqual(isValidLat(999), false);
});

test('Debe rechazar longitud falsa (-500)', () => {
    assert.strictEqual(isValidLon(-500), false);
});

test('Debe rechazar texto basura en lugar de coordenadas', () => {
    assert.strictEqual(isValidLat("hola"), false);
    assert.strictEqual(isValidLon("mundo"), false);
});
