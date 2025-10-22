// jobs/ytWatch.ts
import cron from 'node-cron';
import type { Client, AnyThreadChannel, TextChannel, GuildTextBasedChannel } from 'discord.js';
import { readJson, writeJson } from '../utils/storage.js';
import { fetchYTFeed, type YTItem } from '../utils/youtube.js';
import { sendToChannel } from '../utils/send.js';
import { resolveRoute } from '../utils/ytRouter.js';

export type YTSub = {
  id: string;            // internal id (yt_<stamp>_<rand>)
  channelId: string;     // YouTube channel ID (UCxxxx)
  threadId: string;      // Discord threadId cible (ou channelId si tu préfères)
  title?: string;        // nom humain (optionnel)
  lastVideoId?: string;  // dernière vidéo envoyée
  addedBy: string;
};

const STORE = 'src/data/youtube.json';
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

export async function loadYTSubs(): Promise<YTSub[]> {
  return await readJson<YTSub[]>(STORE, []);
}
export async function saveYTSubs(list: YTSub[]) {
  await writeJson(STORE, list);
}

function newId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `yt_${stamp}_${rnd}`;
}
export { newId as newYTId };

export function registerYTWatchJob(client: Client) {
  const spec = '*/5 * * * *'; // toutes les 5 minutes
  cron.schedule(spec, () => runOnce(client), { timezone: TZ });
  console.log(`[YT] watcher planifié (cron: ${spec}, tz: ${TZ}).`);
}

export async function runOnce(client: Client) {
  try {
    const subs = await loadYTSubs();
    if (!subs.length) return;

    for (const s of subs) {
      try {
        const items = await fetchYTFeed(s.channelId);
        if (!items.length) continue;

        // Trouver ce qui est nouveau depuis lastVideoId
        const idx = s.lastVideoId ? items.findIndex(x => x.videoId === s.lastVideoId) : -1;
        const newOnes = idx === -1 ? items.slice(0, 1) : items.slice(0, idx); // si jamais vide, on prend la + récente 1x

        // Poster du plus ancien au plus récent pour l’ordre
        newOnes.reverse();

        for (const it of newOnes) {
          await postVideo(client, s.threadId, it);
          s.lastVideoId = it.videoId;
        }
      } catch (e) {
        console.error('[YT] fetch/post error for sub', s.channelId, e);
      }
    }
    await saveYTSubs(subs);
  } catch (e) {
    console.error('[YT] runOnce failed', e);
  }
}

async function postVideo(client: Client, defaultThreadId: string, it: YTItem) {
  // On tente de router via le titre
  const routed = await resolveRoute(client, it.title).catch(() => null);
  const targetId = routed?.threadId ?? defaultThreadId;

  const chan = await client.channels.fetch(targetId).catch(() => null);
  if (!chan || !chan.isTextBased()) return;

    const content = `📺 Nouvelle vidéo : **${it.title}**
${it.link}`;

  // @ts-ignore
  await chan.send({ content });
}
