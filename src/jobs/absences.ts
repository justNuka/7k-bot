// src/jobs/absences.ts
import cron from 'node-cron';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);

import { db } from '../db/db.js';

const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

let task: cron.ScheduledTask | null = null;

/**
 * Purge les absences dont la fin est passée (fin inclusive).
 * Anciennement: on gardait si (end+1j) > today; ici, équivalent SQL: on supprime si date(end_iso) < date('now').
 */
export async function cleanupOnce() {
  // Décompte avant / après pour logs
  const before = db.prepare(`SELECT COUNT(*) AS c FROM absences`).get() as { c: number };
  db.prepare(`DELETE FROM absences WHERE date(end_iso) < date('now')`).run();
  const after = db.prepare(`SELECT COUNT(*) AS c FROM absences`).get() as { c: number };

  const purged = before.c - after.c;
  if (purged > 0) {
    console.log(`[ABS] Nettoyage: ${purged} absence(s) purgée(s).`);
  }
}

export function startAbsenceCleanup() {
  if (task) task.stop();
  // Tous les jours à 03:10 (Paris)
  task = cron.schedule('10 3 * * *', () => {
    cleanupOnce().catch((e) => console.error('[ABS] cleanupOnce failed:', e));
  }, { timezone: TZ });
  console.log('[ABS] Cron purge démarré (03:10).');
}
