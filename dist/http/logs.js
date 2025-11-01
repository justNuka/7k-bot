const RING_MAX = 500;
const ring = [];
const clients = new Set();
export function pushLog(entry) {
    const e = {
        component: 'core', // défaut
        ...entry,
        ts: entry.ts ?? new Date().toISOString(),
    };
    ring.push(e);
    if (ring.length > RING_MAX)
        ring.shift();
    const payload = `data: ${JSON.stringify(e)}\n\n`;
    for (const c of clients)
        c.write(payload);
}
export async function registerLogRoutes(app) {
    app.get('/logs/list', async () => ring);
    app.get('/logs/recent', async (req) => {
        const q = req.query?.limit;
        const limit = Math.max(1, Math.min(Number(q ?? 100) || 100, RING_MAX));
        return ring.slice(-limit);
    });
    app.get('/logs/stream', async (req, res) => {
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        const client = {
            write: (s) => res.raw.write(s),
            close: () => res.raw.end(),
        };
        clients.add(client);
        // flush initial
        res.raw.write(`data: ${JSON.stringify({ hello: true })}\n\n`);
        req.raw.on('close', () => {
            clients.delete(client);
            client.close();
        });
    });
}
