// src/db/coaching.ts
import { db } from './db.js';
const insertStmt = db.prepare(`
  INSERT INTO coaching_requests
    (id, user_id, origin_channel_id, type, message, status, created_at)
  VALUES (?,?,?,?,?,?,?)
`);
const selectOpenStmt = db.prepare(`SELECT * FROM coaching_requests WHERE status='open' ORDER BY datetime(created_at) ASC`);
const selectByIdStmt = db.prepare(`SELECT * FROM coaching_requests WHERE id=?`);
const selectMineStmt = db.prepare(`SELECT * FROM coaching_requests WHERE accepted_by=? AND status='accepted' ORDER BY datetime(accepted_at) DESC`);
const acceptStmt = db.prepare(`
  UPDATE coaching_requests
     SET status='accepted',
         accepted_by=?,
         accepted_at=?
   WHERE id=? AND status='open'
`);
const closeStmt = db.prepare(`
  UPDATE coaching_requests
     SET status='closed',
         closed_by=?,
         closed_at=?,
         close_note=?
   WHERE id=? AND status!='closed'
`);
export function newCoachingId() {
    const s = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const r = Math.random().toString(36).slice(2, 6);
    return `crq_${s}_${r}`;
}
export function createRequest(p) {
    const created = p.created_at ?? new Date().toISOString();
    insertStmt.run(p.id, p.user_id, p.origin_channel_id, p.type, p.message, 'open', created);
    return p.id;
}
export function listOpenRequests() {
    return selectOpenStmt.all();
}
export function getRequestById(id) {
    const row = selectByIdStmt.get(id);
    return row ?? null;
}
export function acceptRequest(id, officerId) {
    const now = new Date().toISOString();
    const info = acceptStmt.run(officerId, now, id);
    return info.changes > 0;
}
export function closeRequest(id, officerId, note) {
    const now = new Date().toISOString();
    const info = closeStmt.run(officerId, now, note ?? null, id);
    return info.changes > 0;
}
export function listAcceptedBy(officerId) {
    return selectMineStmt.all(officerId);
}
