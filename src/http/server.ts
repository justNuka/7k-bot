// src/http/server.ts
import Fastify from 'fastify';
import { registerLogRoutes, pushLog } from './logs.js';
import { db } from '../db/db.js';
import { log } from '../utils/logger.js';
import { avatarUrlFrom, fetchMembersSafe } from '../utils/discordMembers.js';
import { Client } from 'discord.js';
import { discordClient } from './context.js';

const API_KEY = process.env.DASH_API_KEY!;
const GUILD_ID = process.env.GUILD_ID!;
const ROLE_OFF = process.env.ROLE_OFFICIERS_ID!;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type NotifRow = {
  id: string;
  role_id: string;
  channel_id: string;
  spec: string;
  tz: string;
  message: string;
  created_by: string;
  channel_name?: string;
  role_name?: string;
  message_display?: string;
};

export async function startHttpServer(client: Client) {
  const app = Fastify({ logger: false });

  // --- middleware auth + log d’accès ---
  app.addHook('onRequest', (req, res, done) => {
    if (!API_KEY) return res.code(500).send({ error: 'no api key configured' });
    
    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'http',
      msg: `[HTTP] ${req.method} ${req.url}`,
      meta: { ip: req.ip }
    });

    const key = req.headers['x-api-key'];

    if (key !== API_KEY) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'warn',
        component: 'http',
        msg: '[HTTP] Unauthorized request',
        meta: { ip: req.ip, url: req.url }
      });
      return res.code(401).send({ error: 'unauthorized' });
    }
    done();
  });

  // --- routes data ---
  app.get('/auth/check', async (req, res) => {
    const uid = (req.query as any)?.uid as string | undefined;
    if (!uid) return res.code(400).send({ ok: false, error: 'missing uid' });

    try {
      if (!discordClient) {
        return res.code(503).send({ ok: false, error: 'discord client not ready' });
      }

      const guild = await discordClient.guilds.fetch(GUILD_ID).catch(() => null);
      if (!guild) return res.code(500).send({ ok: false, error: 'guild not found' });

      const member = await guild.members.fetch(uid).catch(() => null);

      const allowed = !!member && !!ROLE_OFF && member.roles.cache.has(ROLE_OFF);
      const roles = member
        ? Array.from(member.roles.cache.values()).map((r: any) => ({ id: r.id, name: r.name }))
        : [];

      return res.send({ ok: true, allowed, roles });
    } catch (e: any) {
      console.error('[AUTH/CHECK] error', e);
      return res.code(500).send({ ok: false, error: e?.message || 'error' });
    }
  });

  app.get('/health', async () => {
    pushLog({ ts: new Date().toISOString(), level: 'info', component: 'http', msg: '[HEALTH] Check OK' });
    return { ok: true, ts: Date.now() };
  });

  // /api/cr/top
  app.get('/api/cr/top', (req, reply) => {
    const q = (req.query ?? {}) as { limit?: string };
    const limit = Math.max(1, Math.min(1000, Number(q.limit ?? 100)));
    const rows = db.prepare(
      'SELECT user_id, total FROM cr_counters ORDER BY total DESC LIMIT ?'
    ).all(limit);
    reply.send(rows);
  });

  // /api/cr/week
  app.get('/api/cr/week', (req, reply) => {
    const w = db.prepare("SELECT strftime('%Y-%m-%d','now','weekday 1','-7 days') as ws").get() as { ws?: string } | undefined;
    const ws = w?.ws ?? '1970-01-05';
    const rows = db.prepare('SELECT day, user_id FROM cr_week WHERE week_start = ? ORDER BY day').all(ws);
    reply.send(rows);
  });

  // /api/cr/low/week
  app.get('/api/cr/low/week', (req, reply) => {
    const w = db.prepare("SELECT strftime('%Y-%m-%d','now','weekday 1','-7 days') as ws").get() as { ws?: string } | undefined;
    const ws = w?.ws ?? '1970-01-05';
    const rows = db.prepare(
      'SELECT day, user_id, score, note FROM low_week WHERE week_start = ? ORDER BY day'
    ).all(ws) as Array<{day:string;user_id:string;score:number;note?:string|null}>;

    const map: any = { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] };
    for (const r of rows) (map[r.day] ||= []).push({ user_id: r.user_id, score: r.score, note: r.note ?? null });

    reply.send({ weekStart: ws, days: map });
  });

  app.get('/notifs', async () => {
    const rows = db.prepare('SELECT * FROM notifs').all() as NotifRow[];
    if (!client) return rows;

    const guild = await client.guilds.fetch(process.env.GUILD_ID!);

    for (const n of rows) {
      // channel name
      try {
        const chan = await guild.channels.fetch(n.channel_id).catch(() => null);
        if (chan) n.channel_name = chan.name;
      } catch {}

      // role name
      try {
        const role = await guild.roles.fetch(n.role_id).catch(() => null);
        if (role) n.role_name = role.name;
      } catch {}

      // build a human text
      let txt = n.message;

      // 1) token <@&ROLE> → @RoleName (using role_id)
      if (n.role_name) {
        txt = txt.replace(/<@&ROLE>/g, `@${n.role_name}`);
      }

      // 2) numeric mention <@&123> → @RoleName (if someone saved one)
      const m = /<@&(\d+)>/.exec(n.message);
      if (m) {
        const r = await guild.roles.fetch(m[1]).catch(() => null);
        if (r) txt = txt.replace(m[0], `@${r.name}`);
      }

      // 3) remove Discord bold **…**
      txt = txt.replace(/\*\*(.*?)\*\*/g, '$1');

      n.message_display = txt;
    }

    return rows;
  });

  app.get('/banners', async () => 
    db.prepare('SELECT * FROM banners ORDER BY start_iso ASC').all()
  );
  app.get('/candidatures', async () => 
    db.prepare('SELECT * FROM candidatures ORDER BY created_at DESC').all()
  );
  app.get('/yt/subs', async () => 
    db.prepare('SELECT * FROM yt_subs').all()
  );
  app.get('/yt/routes', async () => 
    db.prepare('SELECT * FROM yt_routes').all()
  );

  app.get('/members/resolve', async (req, res) => {
    const q = (req.query as any)?.ids as string | undefined;
    if (!q) return res.send([]);
    const ids = [...new Set(q.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 200);

    // 1) récup du cache
    const rows = db.prepare(
      `SELECT user_id, username, display_name, avatar, updated_at
       FROM members WHERE user_id IN (${ids.map(()=>'?').join(',')})`
    ).all(...ids) as {user_id:string,username:string,display_name:string,avatar:string|null,updated_at:number|null}[];

    const now = Date.now();
    const cached: Record<string, any> = {};
    for (const r of rows) {
      if (r.updated_at && (now - r.updated_at) < CACHE_TTL_MS) {
        cached[r.user_id] = {
          id: r.user_id,
          name: r.display_name || r.username || r.user_id,
          avatar: r.avatar ? `https://cdn.discordapp.com/avatars/${r.user_id}/${r.avatar}.png?size=64`
                           : undefined,
        };
      }
    }

    const missing = ids.filter(id => !cached[id]);

    // 2) fetch Discord pour les manquants
    if (missing.length) {
      const fetched = await fetchMembersSafe(client, GUILD_ID, missing);
      const up = db.prepare(
        `INSERT INTO members(user_id, username, display_name, avatar, updated_at)
         VALUES(?,?,?,?,?)
         ON CONFLICT(user_id) DO UPDATE SET
           username=excluded.username,
           display_name=excluded.display_name,
           avatar=excluded.avatar,
           updated_at=excluded.updated_at`
      );
      for (const id of missing) {
        const m = fetched[id];
        if (!m) continue;
        up.run(
          id,
          m.user.username ?? null,
          m.nickname ?? m.displayName ?? null,
          m.user.avatar ?? null,
          now
        );
        cached[id] = {
          id,
          name: m.nickname || m.displayName || m.user.username || id,
          avatar: avatarUrlFrom(m),
        };
      }
    }

    const result = ids.map(id => cached[id] || { id, name: id, avatar: undefined });
    res.send(result);
  });

  // --- routes logs (SSE + liste) ---
  await registerLogRoutes(app);

  // --- démarrage ---
  const port = Number(process.env.DASH_PORT ?? 8787);
  app.listen({ port, host: '0.0.0.0' })
    .then(() => {
      log.info({ port }, '[DASH] HTTP up');
      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        msg: `[HTTP] Dashboard API démarrée sur le port ${port}`
      });
    })
    .catch(err => {
      log.error(err, '[DASH] fail');
      pushLog({ ts: new Date().toISOString(), level: 'error', msg: '[HTTP] Dashboard start failed', meta: { error: err.message } });
    });
}
