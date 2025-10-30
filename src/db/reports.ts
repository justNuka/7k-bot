import { db } from './db.js';

export type ReportRow = {
  id: string;
  target_id: string;
  note: string;
  created_by: string;
  created_at: string;
};

const insertReportStmt = db.prepare(`
  INSERT INTO reports(id, target_id, note, created_by, created_at)
  VALUES(?,?,?,?,?)
`);
const listReportsStmt = db.prepare<[] /* no params */>(`
  SELECT id, target_id, note, created_by, created_at
  FROM reports
  ORDER BY created_at DESC
`);
const listReportsByUserStmt = db.prepare<[string]>(`
  SELECT id, target_id, note, created_by, created_at
  FROM reports
  WHERE target_id=?
  ORDER BY created_at DESC
`);
const deleteReportStmt = db.prepare<[string]>(`DELETE FROM reports WHERE id=?`);
const getReportStmt    = db.prepare<[string]>(`SELECT * FROM reports WHERE id=?`);

export function insertReport(r: ReportRow) {
  insertReportStmt.run(r.id, r.target_id, r.note, r.created_by, r.created_at);
}
export function listAllReports(): ReportRow[] {
  return listReportsStmt.all() as ReportRow[];
}
export function listReportsByUser(uid: string): ReportRow[] {
  return listReportsByUserStmt.all(uid) as ReportRow[];
}
export function deleteReport(id: string): number {
  const info = deleteReportStmt.run(id);
  return info.changes || 0;
}
export function getReport(id: string): ReportRow | undefined {
  return getReportStmt.get(id) as ReportRow | undefined;
}
