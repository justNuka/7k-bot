// src/db/yt.ts
import { db } from './db.js';

export type YTSubRow = {
  id: string;
  channel_id: string;
  thread_id: string;
  title: string | null;
  last_video: string | null;
  added_by: string;
};

export type YTRouteRow = {
  id: string;
  pattern: string;       // ex: "(?i)seven.*knights"
  thread_id: string | null;
  forum_id: string | null;
  post_title: string | null;
};

// ---------- subs ----------
const insSub = db.prepare(`
  INSERT OR REPLACE INTO yt_subs (id, channel_id, thread_id, title, last_video, added_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const delSubByChannel = db.prepare<[string]>(`DELETE FROM yt_subs WHERE channel_id = ?`);
const selAllSubs = db.prepare<[]>(`SELECT * FROM yt_subs ORDER BY channel_id ASC`);
const selSubByChannel = db.prepare<[string]>(`SELECT * FROM yt_subs WHERE channel_id = ?`);
const updSubThread = db.prepare<[string,string]>(`UPDATE yt_subs SET thread_id = ? WHERE channel_id = ?`);
const updLastVideo = db.prepare<[string,string]>(`UPDATE yt_subs SET last_video = ? WHERE channel_id = ?`);

export function insertSub(row: {
  id: string; channel_id: string; thread_id: string;
  title?: string | null; last_video?: string | null; added_by: string;
}) {
  insSub.run(row.id, row.channel_id, row.thread_id, row.title ?? null, row.last_video ?? null, row.added_by);
}
export function deleteSubByChannel(channelId: string) { delSubByChannel.run(channelId); }
export function listSubs(): YTSubRow[] { return selAllSubs.all() as YTSubRow[]; }
export function getSubByChannel(channelId: string): YTSubRow | null {
  return (selSubByChannel.get(channelId) as YTSubRow | undefined) ?? null;
}
export function updateSubThread(channelId: string, threadId: string) { updSubThread.run(threadId, channelId); }
export function updateSubLastVideo(channelId: string, videoId: string) { updLastVideo.run(videoId, channelId); }

// ---------- routes ----------
const selAllRoutes = db.prepare<[]>(`SELECT * FROM yt_routes ORDER BY id ASC`);
export function listRoutes(): YTRouteRow[] { return selAllRoutes.all() as YTRouteRow[]; }

/** Retourne le thread préféré en fonction du titre */
export function resolveRouteForTitle(title: string): { threadId?: string; forumId?: string; postTitle?: string } | null {
  const routes = listRoutes();
  for (const r of routes) {
    try {
      // supporte /.../i ou une simple string → on interprète comme RegExp case-insensitive
      const rx = r.pattern.startsWith('/') && r.pattern.lastIndexOf('/') > 0
        ? new RegExp(r.pattern.slice(1, r.pattern.lastIndexOf('/')), r.pattern.slice(r.pattern.lastIndexOf('/')+1))
        : new RegExp(r.pattern, 'i');
      if (rx.test(title)) {
        return { threadId: r.thread_id ?? undefined, forumId: r.forum_id ?? undefined, postTitle: r.post_title ?? undefined };
      }
    } catch {}
  }
  return null;
}
