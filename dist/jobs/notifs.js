// src/jobs/notifs.ts
import cron from 'node-cron';
import { sendToChannel } from '../utils/discord/send.js';
import { hhmmToSpec } from '../utils/time/cron.js';
import { ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';
import { listNotifs, getNotif, insertNotif, updateNotif, deleteNotif, upsertPresetNotif } from '../db/notifs.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('Notifs');
const tasks = new Map();
function rowToNotif(r) {
    return {
        id: r.id,
        roleId: r.role_id,
        channelId: r.channel_id,
        spec: r.spec,
        tz: r.tz,
        message: r.message,
        createdBy: r.created_by,
    };
}
/** Presets depuis .env (ID stables) */
export async function ensurePresetNotifs(client, authorId = 'system') {
    const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
    const channelId = CHANNEL_IDS.RAPPELS;
    async function upsert(opts) {
        if (!opts.roleId || !channelId || !opts.hhmm || !opts.freq)
            return;
        const spec = hhmmToSpec(opts.hhmm, opts.freq);
        if (!spec)
            return;
        upsertPresetNotif(opts.stableId, {
            role_id: opts.roleId,
            channel_id: channelId,
            spec,
            tz,
            message: opts.message,
            created_by: authorId,
        });
        // (re)lance la tâche pour ce preset
        const row = getNotif(opts.stableId);
        if (row)
            startNotifTask(client, rowToNotif(row));
    }
    await upsert({
        stableId: 'preset_cr',
        roleId: ROLE_IDS.NOTIF_CR,
        hhmm: process.env.NOTIF_CR_HHMM,
        freq: process.env.NOTIF_CR_FREQ,
        message: '🔔 <@&ROLE> Pensez au **Castle Rush** (avant 02:00) !',
    });
    await upsert({
        stableId: 'preset_daily',
        roleId: ROLE_IDS.NOTIF_DAILY,
        hhmm: process.env.NOTIF_DAILY_HHMM,
        freq: process.env.NOTIF_DAILY_FREQ,
        message: '🧱 <@&ROLE> Pensez aux **dailies de guilde** !',
    });
    await upsert({
        stableId: 'preset_gvg_prep',
        roleId: ROLE_IDS.NOTIF_GVG,
        hhmm: process.env.NOTIF_GVG_PREP_HHMM,
        freq: process.env.NOTIF_GVG_PREP_FREQ,
        message: '⚠️ <@&ROLE> **GvG** demain → préparez vos **défenses** (équipes / gear) !',
    });
    await upsert({
        stableId: 'preset_gvg_start',
        roleId: ROLE_IDS.NOTIF_GVG,
        hhmm: process.env.NOTIF_GVG_START_HHMM,
        freq: process.env.NOTIF_GVG_START_FREQ,
        message: '⚔️ <@&ROLE> **GvG** commence — bons combats !',
    });
}
/** Récup DB pour la commande /notif list */
export async function loadNotifs() {
    return listNotifs().map(rowToNotif);
}
export async function saveNotifs(_) {
    // plus utilisé — la commande manipule via insert/update/delete
}
/** Lance une tâche cron */
export function startNotifTask(client, n) {
    stopNotifTask(n.id);
    const task = cron.schedule(n.spec, async () => {
        try {
            const content = n.message.replace(/<@&ROLE>/g, `<@&${n.roleId}>`);
            await sendToChannel(client, n.channelId, content);
        }
        catch (e) {
            log.error({ notifId: n.id, error: e }, 'Échec envoi notification');
        }
    }, { timezone: n.tz });
    tasks.set(n.id, task);
    return task;
}
export function stopNotifTask(id) {
    const t = tasks.get(id);
    if (t) {
        t.stop();
        tasks.delete(id);
    }
}
export function reloadAllNotifs(client, list) {
    for (const id of tasks.keys())
        stopNotifTask(id);
    for (const n of list)
        startNotifTask(client, n);
}
/** Helpers CRUD utilisés par la commande */
export function createNotif(client, n) {
    insertNotif({
        id: n.id,
        role_id: n.roleId,
        channel_id: n.channelId,
        spec: n.spec,
        tz: n.tz,
        message: n.message,
        created_by: n.createdBy,
    });
    startNotifTask(client, n);
}
export function editNotif(client, n) {
    updateNotif({
        id: n.id,
        role_id: n.roleId,
        channel_id: n.channelId,
        spec: n.spec,
        tz: n.tz,
        message: n.message,
    });
    stopNotifTask(n.id);
    startNotifTask(client, n);
}
export function removeNotif(id) {
    stopNotifTask(id);
    deleteNotif(id);
}
