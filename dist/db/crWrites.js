// src/db/crWrites.ts
import { db } from './db.js';
export function addCrMiss(weekStart, day, userId) {
    const tx = db.transaction(() => {
        // 1) ajoute dans la semaine courante si pas déjà là
        db.prepare(`
      INSERT INTO cr_week(week_start,day,user_id)
      SELECT ?,?,?
      WHERE NOT EXISTS (
        SELECT 1 FROM cr_week WHERE week_start=? AND day=? AND user_id=?
      )
    `).run(weekStart, day, userId, weekStart, day, userId);
        // 2) incrémente le compteur global
        db.prepare(`
      INSERT INTO cr_counters(user_id,total) VALUES(?,1)
      ON CONFLICT(user_id) DO UPDATE SET total = total + 1
    `).run(userId);
    });
    tx();
}
export function addLowScore(weekStart, day, userId, score, note) {
    db.prepare(`
    INSERT INTO low_week(week_start,day,user_id,score,note)
    VALUES(?,?,?,?,?)
  `).run(weekStart, day, userId, score, note ?? null);
}
