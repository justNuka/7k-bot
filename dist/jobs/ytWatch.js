// src/jobs/ytWatch.ts
import cron from 'node-cron';
import { fetchYTFeed } from '../utils/youtube.js';
import { resolveRouteForTitle, listSubs, updateSubLastVideo } from '../db/yt.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('YTWatch');
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';
export function registerYTWatchJob(client) {
    const spec = '*/5 * * * *';
    cron.schedule(spec, () => runOnce(client), { timezone: TZ });
    log.info({ spec, tz: TZ }, 'YouTube watcher planifié');
}
export async function runOnce(client) {
    const subs = listSubs();
    if (!subs.length)
        return;
    for (const s of subs) {
        try {
            const items = await fetchYTFeed(s.channel_id);
            if (!items.length)
                continue;
            const last = s.last_video ?? null;
            const idx = last ? items.findIndex(x => x.videoId === last) : -1;
            const newOnes = idx === -1 ? items.slice(0, 1) : items.slice(0, idx);
            newOnes.reverse();
            for (const it of newOnes) {
                await postVideo(client, s.thread_id, it);
                updateSubLastVideo(s.channel_id, it.videoId);
            }
        }
        catch (e) {
            log.error({ channelId: s.channel_id, error: e }, 'YouTube fetch/post error');
        }
    }
}
async function postVideo(client, defaultThreadId, it) {
    const routed = resolveRouteForTitle(it.title);
    const targetId = routed?.threadId ?? defaultThreadId;
    const chan = await client.channels.fetch(targetId).catch(() => null);
    if (!chan || !chan.isTextBased())
        return;
    const content = `📺 Nouvelle vidéo : **${it.title}**
${it.link}`;
    // @ts-ignore
    await chan.send({ content });
}
// util exposé à la commande /yt test
export async function runOnceForChannel(client, channelId) {
    const items = await fetchYTFeed(channelId);
    return items[0] ?? null;
}
