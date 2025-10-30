// src/db/notifs.ts
import { db } from './db.js';

export type NotifRow = {
  id: string;
  role_id: string;
  channel_id: string;
  spec: string;
  tz: string;
  message: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const ins = db.prepare(`
  INSERT INTO notifs (id, role_id, channel_id, spec, tz, message, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const up = db.prepare(`
  UPDATE notifs
  SET role_id = ?, channel_id = ?, spec = ?, tz = ?, message = ?, updated_at = ?
  WHERE id = ?
`);
const del = db.prepare(`DELETE FROM notifs WHERE id = ?`);
const selAll = db.prepare<[]>(`SELECT * FROM notifs ORDER BY created_at ASC`);
const selOne = db.prepare<[string]>(`SELECT * FROM notifs WHERE id = ?`);

export function insertNotif(n: {
  id: string; role_id: string; channel_id: string;
  spec: string; tz: string; message: string; created_by: string;
}) {
  const now = new Date().toISOString();
  ins.run(n.id, n.role_id, n.channel_id, n.spec, n.tz, n.message, n.created_by, now, now);
}

export function updateNotif(n: {
  id: string; role_id: string; channel_id: string;
  spec: string; tz: string; message: string;
}) {
  const now = new Date().toISOString();
  up.run(n.role_id, n.channel_id, n.spec, n.tz, n.message, now, n.id);
}

export function deleteNotif(id: string) {
  del.run(id);
}

export function getNotif(id: string): NotifRow | null {
  const row = selOne.get(id) as NotifRow | undefined;
  return row ?? null;
}

export function listNotifs(): NotifRow[] {
  return selAll.all() as NotifRow[];
}

/** Upsert “preset” (ID stable) */
export function upsertPresetNotif(id: string, payload: {
  role_id: string; channel_id: string; spec: string; tz: string; message: string; created_by: string;
}) {
  const exists = getNotif(id);
  if (!exists) {
    insertNotif({ id, ...payload });
  } else {
    updateNotif({ id, role_id: payload.role_id, channel_id: payload.channel_id, spec: payload.spec, tz: payload.tz, message: payload.message });
  }
}
