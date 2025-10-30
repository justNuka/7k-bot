// src/app/db/ytRoutes.ts
import { db } from './db.js';

export type YTRouteRow = {
  id: string;
  pattern: string;
  thread_id?: string | null;
  forum_id?: string | null;
  post_title?: string | null;
  created_at: string;
};

const insertThreadStmt = db.prepare(`
  INSERT INTO yt_routes (id, pattern, thread_id, created_at)
  VALUES (?, ?, ?, ?)
`);
const insertForumStmt = db.prepare(`
  INSERT INTO yt_routes (id, pattern, forum_id, post_title, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const listStmt = db.prepare(`
  SELECT id, pattern, thread_id, forum_id, post_title, created_at
  FROM yt_routes
  ORDER BY created_at DESC
`);
const deleteStmt = db.prepare(`DELETE FROM yt_routes WHERE id = ?`);
const findByIdStmt = db.prepare(`
  SELECT id, pattern, thread_id, forum_id, post_title, created_at
  FROM yt_routes
  WHERE id = ?
`);

export function newRouteId() {
  const s = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const r = Math.random().toString(36).slice(2, 6);
  return `rt_${s}_${r}`;
}

export function insertThreadRoute(pattern: string, threadId: string) {
  const id = newRouteId();
  insertThreadStmt.run(id, pattern, threadId, new Date().toISOString());
  return id;
}

export function insertForumRoute(pattern: string, forumId: string, postTitle: string) {
  const id = newRouteId();
  insertForumStmt.run(id, pattern, forumId, postTitle, new Date().toISOString());
  return id;
}

export function listRoutes(): YTRouteRow[] {
  return listStmt.all() as YTRouteRow[];
}

export function deleteRoute(id: string): boolean {
  const info = deleteStmt.run(id);
  return info.changes > 0;
}

export function findRouteById(id: string): YTRouteRow | null {
  return (findByIdStmt.get(id) as YTRouteRow) ?? null;
}

/** Utilisé par ytRouter.resolveRoute(title) */
export function resolveRouteForTitle(title: string): YTRouteRow | null {
  const routes = listRoutes();
  for (const r of routes) {
    const rx = new RegExp(r.pattern, 'i');
    if (rx.test(title)) return r;
  }
  return null;
}
