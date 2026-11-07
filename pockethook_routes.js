// pockethook_routes.js
module.exports = async function pockethookRoutes(fastify, opts) {
        fastify.get('/api/pockethook-queue', async (request, reply) => {
        return { ok: true, queue: [], status: 'online' };
    });
    fastify.get('/api/pockethook/health', async (request, reply) => {
        return { ok: true, status: 'online' };
    });
    fastify.post('/api/pockethook/send-sms', async (request, reply) => {
        const { deviceId, phoneNumber, command } = request.body || {};
        
        if (!phoneNumber) {
            return reply.status(400).send({ error: 'Falta phoneNumber' });
        }

        // Respondemos en el formato que PocketHook espera
        return reply.send({ 
            msg: `Comando para ${deviceId}: ${command || '!R5'}`,
            shortcut: "Comando Anduril SMS", 
            data: {
                deviceId: deviceId || 'unknown',
                phoneNumber: phoneNumber,
                command: command || '!R5'
            }
        });
    });
};