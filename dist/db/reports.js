import { db } from './db.js';
const insertReportStmt = db.prepare(`
  INSERT INTO reports(id, target_id, note, created_by, created_at)
  VALUES(?,?,?,?,?)
`);
const listReportsStmt = db.prepare(`
  SELECT id, target_id, note, created_by, created_at
  FROM reports
  ORDER BY created_at DESC
`);
const listReportsByUserStmt = db.prepare(`
  SELECT id, target_id, note, created_by, created_at
  FROM reports
  WHERE target_id=?
  ORDER BY created_at DESC
`);
const deleteReportStmt = db.prepare(`DELETE FROM reports WHERE id=?`);
const getReportStmt = db.prepare(`SELECT * FROM reports WHERE id=?`);
export function insertReport(r) {
    insertReportStmt.run(r.id, r.target_id, r.note, r.created_by, r.created_at);
}
export function listAllReports() {
    return listReportsStmt.all();
}
export function listReportsByUser(uid) {
    return listReportsByUserStmt.all(uid);
}
export function deleteReport(id) {
    const info = deleteReportStmt.run(id);
    return info.changes || 0;
}
export function getReport(id) {
    return getReportStmt.get(id);
}
