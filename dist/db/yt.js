// src/db/yt.ts
import { db } from './db.js';
// ---------- subs ----------
const insSub = db.prepare(`
  INSERT OR REPLACE INTO yt_subs (id, channel_id, thread_id, title, last_video, added_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const delSubByChannel = db.prepare(`DELETE FROM yt_subs WHERE channel_id = ?`);
const selAllSubs = db.prepare(`SELECT * FROM yt_subs ORDER BY channel_id ASC`);
const selSubByChannel = db.prepare(`SELECT * FROM yt_subs WHERE channel_id = ?`);
const updSubThread = db.prepare(`UPDATE yt_subs SET thread_id = ? WHERE channel_id = ?`);
const updLastVideo = db.prepare(`UPDATE yt_subs SET last_video = ? WHERE channel_id = ?`);
export function insertSub(row) {
    insSub.run(row.id, row.channel_id, row.thread_id, row.title ?? null, row.last_video ?? null, row.added_by);
}
export function deleteSubByChannel(channelId) { delSubByChannel.run(channelId); }
export function listSubs() { return selAllSubs.all(); }
export function getSubByChannel(channelId) {
    return selSubByChannel.get(channelId) ?? null;
}
export function updateSubThread(channelId, threadId) { updSubThread.run(threadId, channelId); }
export function updateSubLastVideo(channelId, videoId) { updLastVideo.run(videoId, channelId); }
// ---------- routes ----------
const selAllRoutes = db.prepare(`SELECT * FROM yt_routes ORDER BY id ASC`);
export function listRoutes() { return selAllRoutes.all(); }
/** Retourne le thread préféré en fonction du titre */
export function resolveRouteForTitle(title) {
    const routes = listRoutes();
    for (const r of routes) {
        try {
            // supporte /.../i ou une simple string → on interprète comme RegExp case-insensitive
            const rx = r.pattern.startsWith('/') && r.pattern.lastIndexOf('/') > 0
                ? new RegExp(r.pattern.slice(1, r.pattern.lastIndexOf('/')), r.pattern.slice(r.pattern.lastIndexOf('/') + 1))
                : new RegExp(r.pattern, 'i');
            if (rx.test(title)) {
                return { threadId: r.thread_id ?? undefined, forumId: r.forum_id ?? undefined, postTitle: r.post_title ?? undefined };
            }
        }
        catch { }
    }
    return null;
}
