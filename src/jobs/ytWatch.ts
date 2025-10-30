// src/jobs/ytWatch.ts
import cron from 'node-cron';
import type { Client } from 'discord.js';
import { fetchYTFeed, type YTItem } from '../utils/youtube.js';
import { resolveRouteForTitle, listSubs, updateSubLastVideo } from '../db/yt.js';

const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

export function registerYTWatchJob(client: Client) {
  const spec = '*/5 * * * *';
  cron.schedule(spec, () => runOnce(client), { timezone: TZ });
  console.log(`[YT] watcher planifié (cron: ${spec}, tz: ${TZ}).`);
}

export async function runOnce(client: Client) {
  const subs = listSubs();
  if (!subs.length) return;

  for (const s of subs) {
    try {
      const items = await fetchYTFeed(s.channel_id);
      if (!items.length) continue;

      const last = s.last_video ?? null;
      const idx = last ? items.findIndex(x => x.videoId === last) : -1;
      const newOnes = idx === -1 ? items.slice(0, 1) : items.slice(0, idx);
      newOnes.reverse();

      for (const it of newOnes) {
        await postVideo(client, s.thread_id, it);
        updateSubLastVideo(s.channel_id, it.videoId);
      }
    } catch (e) {
      console.error('[YT] fetch/post error for', s.channel_id, e);
    }
  }
}

async function postVideo(client: Client, defaultThreadId: string, it: YTItem) {
  const routed = resolveRouteForTitle(it.title);
  const targetId = routed?.threadId ?? defaultThreadId;

  const chan = await client.channels.fetch(targetId).catch(() => null);
  if (!chan || !chan.isTextBased()) return;

  const content = `📺 Nouvelle vidéo : **${it.title}**
${it.link}`;

  // @ts-ignore
  await chan.send({ content });
}

// util exposé à la commande /yt test
export async function runOnceForChannel(client: Client, channelId: string) {
  const items = await fetchYTFeed(channelId);
  return items[0] ?? null;
}
