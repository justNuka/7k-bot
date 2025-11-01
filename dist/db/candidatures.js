// src/db/candidatures.ts
import { db } from './db.js';
// ✅ PREPARED STATEMENTS (tuples typés)
const insertStmt = db.prepare(`INSERT INTO candidatures
    (id,user_id,created_at,channel_id,message_url,has_attachments,status)
  VALUES(?,?,?,?,?,?,?)`);
const listOpenPagedStmt = db.prepare(`SELECT id,user_id,created_at,channel_id,message_url,has_attachments,status
    FROM candidatures
   WHERE status='open'
ORDER BY datetime(created_at) DESC
   LIMIT ? OFFSET ?`);
const findOpenByUserStmt = db.prepare(`
  SELECT id FROM candidatures
   WHERE user_id=? AND status='open'
   LIMIT 1
`);
const countOpenStmt = db.prepare(`SELECT COUNT(*) as c FROM candidatures WHERE status='open'`);
const setStatusStmt = db.prepare(`
  UPDATE candidatures SET status=? WHERE id=?
`);
const getByIdStmt = db.prepare(`
  SELECT id,user_id,created_at,channel_id,message_url,has_attachments,status
    FROM candidatures
   WHERE id=?`);
export function insertCandidature(row) {
    insertStmt.run(row.id, row.user_id, row.created_at, row.channel_id, row.message_url ?? null, row.has_attachments ? 1 : 0, row.status);
}
export function listOpenCandidaturesPaged(limit, offset) {
    return listOpenPagedStmt.all(limit, offset);
}
export function countOpenCandidatures() {
    const r = countOpenStmt.get();
    return r?.c ?? 0;
}
export function setCandidatureStatus(id, status) {
    setStatusStmt.run(status, id);
}
export function getCandidatureById(id) {
    return getByIdStmt.get(id) ?? null;
}
export function hasOpenForUser(userId) {
    const r = findOpenByUserStmt.get(userId);
    return !!r;
}
