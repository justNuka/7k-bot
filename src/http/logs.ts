// src/http/logs.ts
import type { FastifyInstance } from 'fastify';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'action';
export type LogEntry = {
  ts: string;
  level: LogLevel;
  msg: string;
  component?: string;
  meta?: Record<string, any>;
};

const RING_MAX = 500;
const ring: LogEntry[] = [];
const clients = new Set<{ write: (s: string) => void; close: () => void }>();

export function pushLog(entry: LogEntry) {
  const e: LogEntry = {
    component: 'core', // défaut
    ...entry,
    ts: entry.ts ?? new Date().toISOString(),
  };
  ring.push(e);
  if (ring.length > RING_MAX) ring.shift();

  const payload = `data: ${JSON.stringify(e)}\n\n`;
  for (const c of clients) c.write(payload);
}

export async function registerLogRoutes(app: FastifyInstance) {
  app.get('/logs/list', async () => ring);

  app.get('/logs/recent', async (req) => {
    const q = (req.query as any)?.limit;
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
      write: (s: string) => res.raw.write(s),
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
