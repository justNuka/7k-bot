// src/jobs/absences.ts
import cron from 'node-cron';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);
dayjs.extend(tz);
import { db } from '../db/db.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('Absences');
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';
let task = null;
/**
 * Purge les absences dont la fin est passée (fin inclusive).
 * Anciennement: on gardait si (end+1j) > today; ici, équivalent SQL: on supprime si date(end_iso) < date('now').
 */
export async function cleanupOnce() {
    // Décompte avant / après pour logs
    const before = db.prepare(`SELECT COUNT(*) AS c FROM absences`).get();
    db.prepare(`DELETE FROM absences WHERE date(end_iso) < date('now')`).run();
    const after = db.prepare(`SELECT COUNT(*) AS c FROM absences`).get();
    const purged = before.c - after.c;
    if (purged > 0) {
        log.info({ count: purged }, 'Absences purgées');
    }
}
export function startAbsenceCleanup() {
    if (task)
        task.stop();
    // Tous les jours à 03:10 (Paris)
    task = cron.schedule('10 3 * * *', () => {
        cleanupOnce().catch((e) => log.error({ error: e }, 'Échec cleanupOnce'));
    }, { timezone: TZ });
    log.info({ tz: TZ }, 'Cron purge absences démarré (03:10)');
}
