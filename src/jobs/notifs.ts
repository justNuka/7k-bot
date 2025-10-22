// src/jobs/notifs.ts
import cron, { ScheduledTask } from 'node-cron';
import { readJson, writeJson } from '../utils/storage.js';
import { sendToChannel } from '../utils/send.js';
import type { Client } from 'discord.js';
import { hhmmToSpec } from '../utils/cron.js';
import { ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';

export type Notif = {
  id: string;
  roleId: string;
  channelId: string;
  spec: string;
  tz: string;
  message: string;
  createdBy: string;
};

const STORE_PATH = 'src/data/notifs.json';
const tasks = new Map<string, ScheduledTask>();

export async function ensurePresetNotifs(client: Client, authorId = 'system') {
  const list = await loadNotifs();
  const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
  const channelId = CHANNEL_IDS.RAPPELS;

  async function upsertPreset(opts: { roleId?: string; hhmm?: string; freq?: string; message: string; stableId: string; }) {
    if (!opts.roleId || !channelId || !opts.hhmm || !opts.freq) return;
    const spec = hhmmToSpec(opts.hhmm, opts.freq as any);
    if (!spec) return;

    let n = list.find(x => x.id === opts.stableId);
    if (!n) {
      n = {
        id: opts.stableId,
        roleId: opts.roleId,
        channelId,
        spec,
        tz,
        message: opts.message,
        createdBy: authorId,
      };
      list.push(n);
    } else {
      n.roleId = opts.roleId;
      n.channelId = channelId;
      n.spec = spec;
      n.tz = tz;
      n.message = opts.message;
    }
    startNotifTask(client, n);
  }

  // CR — quotidien 18:00
  await upsertPreset({
    roleId: ROLE_IDS.NOTIF_CR,
    hhmm: process.env.NOTIF_CR_HHMM,
    freq: process.env.NOTIF_CR_FREQ,
    message: '🔔 <@&ROLE> Pensez au **Castle Rush** (avant 02:00) !',
    stableId: 'preset_cr',
  });

  // Daily — quotidien 18:00
  await upsertPreset({
    roleId: ROLE_IDS.NOTIF_DAILY,
    hhmm: process.env.NOTIF_DAILY_HHMM,
    freq: process.env.NOTIF_DAILY_FREQ,
    message: '🧱 <@&ROLE> Pensez aux **dailies de guilde** !',
    stableId: 'preset_daily',
  });

  // GvG PREP — jeudi 02:00
  await upsertPreset({
    roleId: ROLE_IDS.NOTIF_GVG,
    hhmm: process.env.NOTIF_GVG_PREP_HHMM,
    freq: process.env.NOTIF_GVG_PREP_FREQ,
    message: '⚠️ <@&ROLE> **GvG** demain → préparez vos **défenses** (équipes / gear) !',
    stableId: 'preset_gvg_prep',
  });

  // GvG START — jeudi 13:00
  await upsertPreset({
    roleId: ROLE_IDS.NOTIF_GVG,
    hhmm: process.env.NOTIF_GVG_START_HHMM,
    freq: process.env.NOTIF_GVG_START_FREQ,
    message: '⚔️ <@&ROLE> **GvG** commence — bons combats !',
    stableId: 'preset_gvg_start',
  });

  await saveNotifs(list);
  console.log('[NOTIF] Presets ensured. Total now:', list.length);
}


export async function loadNotifs(): Promise<Notif[]> {
  return await readJson<Notif[]>(STORE_PATH, []);
}
export async function saveNotifs(list: Notif[]) {
  await writeJson(STORE_PATH, list);
}

export function startNotifTask(client: Client, n: Notif) {
  stopNotifTask(n.id);
  const task = cron.schedule(n.spec, async () => {
    try {
      const content = n.message.replace(/<@&ROLE>/g, `<@&${n.roleId}>`);
      await sendToChannel(client, n.channelId, content);
    } catch (e) {
      console.error('[NOTIF] send fail:', n.id, e);
    }
  }, { timezone: n.tz });
  tasks.set(n.id, task);
  return task;
}

export function stopNotifTask(id: string) {
  const t = tasks.get(id);
  if (t) { t.stop(); tasks.delete(id); }
}

export function reloadAllNotifs(client: Client, list: Notif[]) {
  // stop all
  for (const id of tasks.keys()) stopNotifTask(id);
  // start all
  for (const n of list) startNotifTask(client, n);
}
