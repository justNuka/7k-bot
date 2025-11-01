// src/db/banners.ts
import { db } from './db.js';
// --- prepared statements with correct bind tuple types ---
const insertStmt = db.prepare(`
  INSERT INTO banners(id, name, start_iso, end_iso, note, image, added_by)
  VALUES(?,?,?,?,?,?,?)
`);
const updateStmt = db.prepare(`
  UPDATE banners
     SET name=?,
         start_iso=?,
         end_iso=?,
         note=?,
         image=?
   WHERE id=?
`);
const deleteStmt = db.prepare(`DELETE FROM banners WHERE id=?`);
const selectAllStmt = db.prepare(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
ORDER BY start_iso ASC
`);
const selectUpcomingStmt = db.prepare(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE end_iso > ?
ORDER BY start_iso ASC
`);
const selectNextStmt = db.prepare(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE end_iso > ?
ORDER BY start_iso ASC
   LIMIT 1
`);
const getByIdStmt = db.prepare(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE id=?
`);
// --- API ---
export function insertBanner(b) {
    insertStmt.run(b.id, b.name, b.start_iso, b.end_iso, b.note ?? null, b.image ?? null, b.added_by);
    return b;
}
export function updateBanner(p) {
    updateStmt.run(p.name, p.start_iso, p.end_iso, p.note ?? null, p.image ?? null, p.id);
}
export function removeBannerById(id) {
    const info = deleteStmt.run(id);
    return info.changes > 0;
}
export function listAllBanners() {
    return selectAllStmt.all();
}
export function listUpcomingBanners(nowIso) {
    return selectUpcomingStmt.all(nowIso);
}
export function getNextBanner(nowIso) {
    const row = selectNextStmt.get(nowIso);
    return row ?? null;
}
export function getBannerById(id) {
    const row = getByIdStmt.get(id);
    return row ?? null;
}
