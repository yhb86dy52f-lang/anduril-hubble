function parseSmartGPS(text) {
    let lat = null, lon = null, speed = null, deviceId = null, battery = null;

    // Regex seguros
    const latMatch = text.match(/(?:LAT|Lat|lat)[:=]\s*(-?\d+\.\d+)/);
    const lonMatch = text.match(/(?:LON|Lon|lon|LNG|Lng|lng)[:=]\s*(-?\d+\.\d+)/);
    if (latMatch && lonMatch) {
        lat = parseFloat(latMatch[1]);
        lon = parseFloat(lonMatch[1]);
    }

    const idMatch = text.match(/(?:MID|mid|ESN|esn)[:=]\s*(\d+)/);
    if (idMatch) deviceId = idMatch[1];

    const speedMatch = text.match(/(?:SPD|Spd|spd)[:=]\s*(\d+)/);
    if (speedMatch) speed = parseFloat(speedMatch[1]);

    const voltMatch = text.match(/(\d+\.\d+)V/);
    if (voltMatch) battery = parseFloat(voltMatch[1]);

    return { lat, lon, deviceId, speed, battery };
}

module.exports = { parseSmartGPS };