import cron from 'node-cron';
import { db } from '../db/db.js';
import { currentWeekStart } from '../utils/time/week.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { dayLabel } from '../utils/cr/cr.js';
import { sendToChannel } from '../utils/discord/send.js';
import { discordAbsolute } from '../utils/time/time.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('CRWeeklyReset');
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function buildWeeklyRecapEmbed(weekStart, byDay) {
    // champs jour par jour
    const fields = DAYS.map((k) => {
        const list = byDay[k];
        const text = list.length ? list.map(id => `<@${id}>`).join('\n') : '—';
        return { name: dayLabel(k), value: text, inline: true };
    });
    // mini top hebdo
    const counts = new Map();
    for (const k of DAYS)
        for (const uid of byDay[k]) {
            counts.set(uid, (counts.get(uid) ?? 0) + 1);
        }
    const topLines = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([uid, n]) => `**${n}** — <@${uid}>`)
        .join('\n') || '—';
    return makeEmbed({
        title: `🗓 Récap CR — semaine du ${discordAbsolute(weekStart, 'F')}`,
        description: 'Liste des oublis par jour (lun→dim) et top hebdo.',
        fields: [
            ...fields,
            { name: '🏆 Top hebdo (attention à la porte)', value: topLines }
        ],
        footer: 'Reset automatique chaque lundi à 02:15 (heure Paris)',
        timestamp: new Date(weekStart)
    });
}
function buildLowScoreEmbed(weekStart, byDay) {
    const fields = DAYS.map((k) => {
        const list = byDay[k];
        const text = list.length
            ? list.map(e => `• <@${e.user_id}> — **${e.score}**${e.note ? ` — _${e.note}_` : ''}`).join('\n')
            : '—';
        return { name: dayLabel(k), value: text, inline: false };
    });
    return makeEmbed({
        title: `📉 Récap low scores — semaine du ${discordAbsolute(weekStart, 'F')}`,
        fields,
        footer: 'Reset automatique chaque lundi à 02:15 (heure Paris)',
        timestamp: new Date(weekStart)
    });
}
export function registerWeeklyResetJob(client) {
    const spec = process.env.CR_WEEKLY_RESET_CRON || '15 2 * * 1'; // lundi 02:15
    const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
    const channelId = process.env.CR_LOGS_CHANNEL_ID;
    cron.schedule(spec, async () => {
        try {
            // Semaine à récap = la semaine **précédente**
            // currentWeekStart() retourne le lundi de la semaine courante → on soustrait 7 jours
            const current = currentWeekStart(); // YYYY-MM-DD (lundi courant)
            const prev = db.prepare("SELECT date(?, '-7 day') AS ws").get(current);
            const prevWeekStart = prev.ws;
            // 1) Charger CR hebdo de la semaine précédente
            const crRows = db.prepare('SELECT day, user_id FROM cr_week WHERE week_start = ? ORDER BY day').all(prevWeekStart);
            const crByDay = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
            for (const r of crRows)
                crByDay[r.day].push(r.user_id);
            // 2) Charger low scores de la semaine précédente
            const lowRows = db.prepare('SELECT day, user_id, score, note FROM low_week WHERE week_start = ? ORDER BY day').all(prevWeekStart);
            const lowByDay = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
            for (const r of lowRows)
                lowByDay[r.day].push({ user_id: r.user_id, score: r.score, note: r.note ?? null });
            // 3) Poster les récap si un salon est configuré
            if (channelId) {
                const embedCr = buildWeeklyRecapEmbed(prevWeekStart, crByDay);
                const embedLow = buildLowScoreEmbed(prevWeekStart, lowByDay);
                await sendToChannel(client, channelId, { embeds: [embedCr] });
                await sendToChannel(client, channelId, { embeds: [embedLow] });
            }
            // 4) Nettoyer la **semaine courante** pour repartir sur une base vide (au cas où)
            const weekStartNow = currentWeekStart();
            db.prepare('DELETE FROM cr_week  WHERE week_start = ?').run(weekStartNow);
            db.prepare('DELETE FROM low_week WHERE week_start = ?').run(weekStartNow);
            log.info({ weekStart: prevWeekStart }, 'Récap hebdo CR posté et semaine courante nettoyée');
        }
        catch (e) {
            log.error({ error: e }, 'Échec job reset hebdomadaire CR');
        }
    }, { timezone: tz });
}
