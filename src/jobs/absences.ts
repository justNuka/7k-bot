import cron from 'node-cron';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);

import { readJson, writeJson } from '../utils/storage.js';
const STORE = 'src/data/absences.json';
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

type Absence = { id: string; end: string };
type Store = { items: Absence[] };

let task: cron.ScheduledTask | null = null;

export async function cleanupOnce() {
  const now = dayjs().tz(TZ).startOf('day');
  const store = await readJson<Store>(STORE, { items: [] });

  const keep = store.items.filter(a => {
    const endPlusOne = dayjs(a.end).tz(TZ).startOf('day').add(1, 'day');
    return endPlusOne.isAfter(now);
  });

  if (keep.length !== store.items.length) {
    await writeJson(STORE, { items: keep as any });
    console.log(`[ABS] Nettoyage: ${store.items.length - keep.length} absence(s) purgée(s).`);
  }
}

export function startAbsenceCleanup() {
  if (task) task.stop();
  // Tous les jours à 03:10 (Paris)
  task = cron.schedule('10 3 * * *', () => { cleanupOnce().catch(() => {}); }, { timezone: TZ });
  console.log('[ABS] Cron purge démarré (03:10).');
}
