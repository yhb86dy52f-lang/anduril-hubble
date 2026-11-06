# NEXUS-SENTINEL // Andúril Hubble

**Proyecto personal, no comercial.** Panel táctico de rastreo para mis propios dispositivos.
El nombre "Andúril" está inspirado en la espada de J.R.R. Tolkien (La Llama del Oeste). 
Sin afiliación a Anduril Industries, Hubble Network, ni a ninguna empresa de defensa.

## Stack Técnico
- **Backend:** Fastify + SQLite (better-sqlite3)
- **Frontend:** Vanilla JS + Leaflet (HUD Táctico y Flota)
- **Hardware:** ESP32 + BLE
- **QA:** Node.js Native Test Runner (TDD)

## Instalación
1. Clonar el repo.
2. 
npm install
3. Copiar .env.example a .env y configurar API_KEY.
4. 
npm start

## Seguridad
- Ninguna API Key está expuesta en el frontend.
- La ingesta de GPS cuenta con validación estricta (latitud -90 a 90, longitud -180 a 180).
- Los datos de telemetría y bases de datos están excluidos del repositorio.

