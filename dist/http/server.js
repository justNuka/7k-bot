// src/http/server.ts
import Fastify from 'fastify';
import { registerLogRoutes, pushLog } from './logs.js';
import { db } from '../db/db.js';
import { log } from '../utils/logger.js';
import { avatarUrlFrom, fetchMembersSafe } from '../utils/discord/members.js';
import { discordClient } from './context.js';
import { listAllAbsences, listActiveAbsences } from '../db/absences.js';
import { getNextBanner, listAllBanners, listUpcomingBanners } from '../db/banners.js';
const API_KEY = process.env.DASH_API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_OFF = process.env.ROLE_OFFICIERS_ID;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export async function startHttpServer(client) {
    const app = Fastify({ logger: false });
    // --- middleware auth + log d’accès ---
    app.addHook('onRequest', (req, res, done) => {
        if (!API_KEY)
            return res.code(500).send({ error: 'no api key configured' });
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
        const uid = req.query?.uid;
        if (!uid)
            return res.code(400).send({ ok: false, error: 'missing uid' });
        try {
            if (!discordClient) {
                return res.code(503).send({ ok: false, error: 'discord client not ready' });
            }
            const guild = await discordClient.guilds.fetch(GUILD_ID).catch(() => null);
            if (!guild)
                return res.code(500).send({ ok: false, error: 'guild not found' });
            const member = await guild.members.fetch(uid).catch(() => null);
            const allowed = !!member && !!ROLE_OFF && member.roles.cache.has(ROLE_OFF);
            const roles = member
                ? Array.from(member.roles.cache.values()).map((r) => ({ id: r.id, name: r.name }))
                : [];
            return res.send({ ok: true, allowed, roles });
        }
        catch (e) {
            console.error('[AUTH/CHECK] error', e);
            return res.code(500).send({ ok: false, error: e?.message || 'error' });
        }
    });
    /**
     * Health check endpoint amélioré
     * Vérifie l'état du bot, de la DB et de Discord
     */
    app.get('/health', async (_req, res) => {
        const startTime = Date.now();
        const checks = {};
        // Check 1: Database
        try {
            const result = db.prepare('SELECT 1 as test').get();
            checks.database = { status: 'ok', responsive: true };
        }
        catch (err) {
            checks.database = { status: 'error', error: err.message };
        }
        // Check 2: Discord Client
        try {
            if (!discordClient) {
                checks.discord = { status: 'error', error: 'client not initialized' };
            }
            else if (!discordClient.isReady()) {
                checks.discord = { status: 'error', error: 'client not ready' };
            }
            else {
                checks.discord = {
                    status: 'ok',
                    user: discordClient.user?.tag,
                    uptime: Math.floor((discordClient.uptime || 0) / 1000),
                    guilds: discordClient.guilds.cache.size,
                    ping: discordClient.ws.ping,
                };
            }
        }
        catch (err) {
            checks.discord = { status: 'error', error: err.message };
        }
        // Check 3: Memory
        const mem = process.memoryUsage();
        checks.memory = {
            status: 'ok',
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // MB
            rss: Math.round(mem.rss / 1024 / 1024), // MB
        };
        // Check 4: Uptime
        checks.process = {
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
        };
        // Résultat global
        const allOk = checks.database.status === 'ok' && checks.discord.status === 'ok';
        const responseTime = Date.now() - startTime;
        const response = {
            ok: allOk,
            timestamp: new Date().toISOString(),
            responseTime,
            checks,
        };
        pushLog({
            ts: new Date().toISOString(),
            level: allOk ? 'info' : 'warn',
            component: 'http',
            msg: `[HEALTH] ${allOk ? 'OK' : 'DEGRADED'}`,
            meta: { responseTime, allOk }
        });
        return res.code(allOk ? 200 : 503).send(response);
    });
    // --- absences (sqlite) ---
    app.get('/absences/all', async (_req, reply) => {
        const rows = listAllAbsences();
        reply.send(rows);
    });
    app.get('/absences/active', async (_req, reply) => {
        const rows = listActiveAbsences();
        reply.send(rows);
    });
    // /api/cr/top
    app.get('/api/cr/top', (req, reply) => {
        const q = (req.query ?? {});
        const limit = Math.max(1, Math.min(1000, Number(q.limit ?? 100)));
        const rows = db.prepare('SELECT user_id, total FROM cr_counters ORDER BY total DESC LIMIT ?').all(limit);
        reply.send(rows);
    });
    // /api/cr/week
    // /api/cr/week?ws=YYYY-MM-DD   (par défaut: semaine actuelle)
    app.get('/api/cr/week', (req, reply) => {
        const q = (req.query ?? {});
        const w = (q.ws ??
            db.prepare("SELECT strftime('%Y-%m-%d','now','weekday 1','-7 days') AS ws")
                .get()?.ws) || '1970-01-05';
        const rows = db.prepare('SELECT day, user_id FROM cr_week WHERE week_start = ? ORDER BY day').all(w);
        reply.send(rows);
    });
    // /api/cr/low/week?ws=YYYY-MM-DD   (par défaut: semaine actuelle)
    app.get('/api/cr/low/week', (req, reply) => {
        const q = (req.query ?? {});
        const w = (q.ws ??
            db.prepare("SELECT strftime('%Y-%m-%d','now','weekday 1','-7 days') AS ws")
                .get()?.ws) || '1970-01-05';
        const rows = db.prepare('SELECT day, user_id, score, note FROM low_week WHERE week_start = ? ORDER BY day').all(w);
        const map = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
        for (const r of rows)
            (map[r.day] ||= []).push({ user_id: r.user_id, score: r.score, note: r.note ?? null });
        reply.send({ weekStart: w, days: map });
    });
    app.get('/api/cr/history', (req, reply) => {
        const q = (req.query ?? {});
        const limit = Math.max(1, Math.min(52, Number(q.limit ?? 12)));
        const weeks = db.prepare(`
      SELECT week_start FROM cr_weeks
      ORDER BY week_start DESC
      LIMIT ?
    `).all(limit);
        const payload = weeks.map(w => {
            const misses = db.prepare(`
        SELECT day, user_id FROM cr_week_history WHERE week_start=? ORDER BY day
      `).all(w.week_start);
            const lows = db.prepare(`
        SELECT day, user_id, score, note FROM low_week_history WHERE week_start=? ORDER BY day
      `).all(w.week_start);
            return { weekStart: w.week_start, misses, lows };
        });
        reply.send(payload);
    });
    app.get('/notifs', async () => {
        const rows = db.prepare('SELECT * FROM notifs').all();
        if (!client)
            return rows;
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        for (const n of rows) {
            // channel name
            try {
                const chan = await guild.channels.fetch(n.channel_id).catch(() => null);
                if (chan)
                    n.channel_name = chan.name;
            }
            catch { }
            // role name
            try {
                const role = await guild.roles.fetch(n.role_id).catch(() => null);
                if (role)
                    n.role_name = role.name;
            }
            catch { }
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
                if (r)
                    txt = txt.replace(m[0], `@${r.name}`);
            }
            // 3) remove Discord bold **…**
            txt = txt.replace(/\*\*(.*?)\*\*/g, '$1');
            n.message_display = txt;
        }
        return rows;
    });
    app.get('/banners', async () => listAllBanners());
    app.get('/banners/upcoming', async () => listUpcomingBanners(new Date().toISOString()));
    app.get('/banners/next', async () => getNextBanner(new Date().toISOString()));
    app.get('/candidatures', async () => db.prepare('SELECT * FROM candidatures ORDER BY created_at DESC').all());
    app.get('/reports', async () => {
        const rows = db.prepare(`
      SELECT id, target_id, note, created_by, created_at
      FROM reports
      ORDER BY created_at DESC
    `).all();
        return rows;
    });
    // Filtre par user
    app.get('/reports/by-user', async (req, reply) => {
        const uid = req.query?.uid;
        if (!uid)
            return reply.code(400).send({ error: 'missing uid' });
        const rows = db.prepare(`
      SELECT id, target_id, note, created_by, created_at
      FROM reports
      WHERE target_id = ?
      ORDER BY created_at DESC
    `).all(uid);
        reply.send(rows);
    });
    app.get('/notif/panel-ref', async () => {
        const row = db.prepare(`
      SELECT channel_id, message_id, updated_at
      FROM notif_panel_ref
      WHERE id = 1
    `).get() || null;
        return row ?? {};
    });
    app.get('/yt/subs', async () => db.prepare('SELECT * FROM yt_subs').all());
    app.get('/yt/routes', async () => db.prepare('SELECT * FROM yt_routes').all());
    app.get('/members/resolve', async (req, res) => {
        const q = req.query?.ids;
        if (!q)
            return res.send([]);
        const ids = [...new Set(q.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 200);
        // 1) récup du cache
        const rows = db.prepare(`SELECT user_id, username, display_name, avatar, updated_at
       FROM members WHERE user_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
        const now = Date.now();
        const cached = {};
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
            const up = db.prepare(`INSERT INTO members(user_id, username, display_name, avatar, updated_at)
         VALUES(?,?,?,?,?)
         ON CONFLICT(user_id) DO UPDATE SET
           username=excluded.username,
           display_name=excluded.display_name,
           avatar=excluded.avatar,
           updated_at=excluded.updated_at`);
            for (const id of missing) {
                const m = fetched[id];
                if (!m)
                    continue;
                up.run(id, m.user.username ?? null, m.nickname ?? m.displayName ?? null, m.user.avatar ?? null, now);
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
    // --- route restart bot ---
    app.post('/admin/restart', async (req, res) => {
        try {
            const { triggered_by, timestamp } = req.body;
            pushLog({
                ts: new Date().toISOString(),
                level: 'action',
                component: 'admin',
                msg: `[RESTART] Bot restart triggered by ${triggered_by || 'unknown'}`,
                meta: { timestamp, triggered_by }
            });
            log.warn({ triggered_by, timestamp }, '[ADMIN] Bot restart requested');
            // Répondre immédiatement avant de quitter
            res.send({
                success: true,
                message: 'Bot will restart in 2 seconds',
                triggered_by,
                timestamp: new Date().toISOString(),
            });
            // Quitter proprement après 2 secondes (permet à la réponse d'être envoyée)
            setTimeout(() => {
                log.info('[ADMIN] Exiting for restart...');
                pushLog({
                    ts: new Date().toISOString(),
                    level: 'action',
                    msg: '[RESTART] Bot exiting for restart'
                });
                process.exit(0); // PM2 ou systemd va automatiquement redémarrer
            }, 2000);
        }
        catch (error) {
            log.error({ error }, '[ADMIN] Restart failed');
            res.code(500).send({ error: 'Restart failed', details: error.message });
        }
    });
    // --- démarrage ---
    const port = Number(process.env.DASH_PORT ?? 8787);
    const host = process.env.DASH_HOST ?? '0.0.0.0'; // Listen on all interfaces (localhost accessible)
    app.listen({ port, host })
        .then(() => {
        log.info({ port, host }, '[DASH] HTTP up');
        pushLog({
            ts: new Date().toISOString(),
            level: 'action',
            msg: `[HTTP] Dashboard API démarrée sur ${host}:${port}`
        });
    })
        .catch(err => {
        log.error(err, '[DASH] fail');
        pushLog({ ts: new Date().toISOString(), level: 'error', msg: '[HTTP] Dashboard start failed', meta: { error: err.message } });
    });
}
