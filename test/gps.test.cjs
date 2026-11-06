const test = require('node:test');
const assert = require('node:assert');

// Replicamos la lógica de validación del middleware para testearla aislada
function validarCoordenadas(lat, lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (isNaN(latitude) || isNaN(longitude)) return { valido: false, error: 'No son números' };
    if (latitude < -90 || latitude > 90) return { valido: false, error: 'Latitud fuera de rango' };
    if (longitude < -180 || longitude > 180) return { valido: false, error: 'Longitud fuera de rango' };
    return { valido: true };
}

test('Debe aceptar coordenadas válidas', () => {
    const res = validarCoordenadas(25.5446, -103.5331); // Torreón, Coahuila
    assert.strictEqual(res.valido, true);
});

test('Debe rechazar latitud falsa (999)', () => {
    const res = validarCoordenadas(999, -103.5331);
    assert.strictEqual(res.valido, false);
    assert.strictEqual(res.error, 'Latitud fuera de rango');
});

test('Debe rechazar longitud falsa (-500)', () => {
    const res = validarCoordenadas(25.5446, -500);
    assert.strictEqual(res.valido, false);
    assert.strictEqual(res.error, 'Longitud fuera de rango');
});

test('Debe rechazar texto basura en lugar de coordenadas', () => {
    const res = validarCoordenadas("hola", "mundo");
    assert.strictEqual(res.valido, false);
    assert.strictEqual(res.error, 'No son números');
});
