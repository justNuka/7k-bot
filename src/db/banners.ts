// src/db/banners.ts
import { db } from './db.js';

export type BannerRow = {
  id: string;
  name: string;
  start_iso: string;
  end_iso: string;
  note: string | null;
  image: string | null;
  added_by: string;
};

// --- prepared statements with correct bind tuple types ---
const insertStmt = db.prepare<
  [string, string, string, string, string | null, string | null, string]
>(`
  INSERT INTO banners(id, name, start_iso, end_iso, note, image, added_by)
  VALUES(?,?,?,?,?,?,?)
`);

const updateStmt = db.prepare<
  [string, string, string, string | null, string | null, string]
>(`
  UPDATE banners
     SET name=?,
         start_iso=?,
         end_iso=?,
         note=?,
         image=?
   WHERE id=?
`);

const deleteStmt = db.prepare<[string]>(`DELETE FROM banners WHERE id=?`);

const selectAllStmt = db.prepare<[] /* no params */>(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
ORDER BY start_iso ASC
`);

const selectUpcomingStmt = db.prepare<[string]>(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE end_iso > ?
ORDER BY start_iso ASC
`);

const selectNextStmt = db.prepare<[string]>(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE end_iso > ?
ORDER BY start_iso ASC
   LIMIT 1
`);

const getByIdStmt = db.prepare<[string]>(`
  SELECT id,name,start_iso,end_iso,note,image,added_by
    FROM banners
   WHERE id=?
`);

// --- API ---
export function insertBanner(b: BannerRow) {
  insertStmt.run(
    b.id,
    b.name,
    b.start_iso,
    b.end_iso,
    b.note ?? null,
    b.image ?? null,
    b.added_by
  );
  return b;
}

export function updateBanner(p: {
  id: string;
  name: string;
  start_iso: string;
  end_iso: string;
  note: string | null;
  image: string | null;
}) {
  updateStmt.run(
    p.name,
    p.start_iso,
    p.end_iso,
    p.note ?? null,
    p.image ?? null,
    p.id
  );
}

export function removeBannerById(id: string) {
  const info = deleteStmt.run(id);
  return info.changes > 0;
}

export function listAllBanners(): BannerRow[] {
  return selectAllStmt.all() as BannerRow[];
}

export function listUpcomingBanners(nowIso: string): BannerRow[] {
  return selectUpcomingStmt.all(nowIso) as BannerRow[];
}

export function getNextBanner(nowIso: string): BannerRow | null {
  const row = selectNextStmt.get(nowIso) as BannerRow | undefined;
  return row ?? null;
}

export function getBannerById(id: string): BannerRow | null {
  const row = getByIdStmt.get(id) as BannerRow | undefined;
  return row ?? null;
}
