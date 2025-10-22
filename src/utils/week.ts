import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';

dayjs.extend(utc); dayjs.extend(timezone); dayjs.extend(isoWeek);

const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

export function currentWeekStart() {
  // lundi de la semaine, 00:00 TZ
  return dayjs().tz(TZ).isoWeekday(1).startOf('day').format('YYYY-MM-DD');
}

export function isOutdated(weekStart: string | undefined) {
  if (!weekStart) return true;
  return weekStart !== currentWeekStart();
}
