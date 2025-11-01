import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';
export function currentWeekStart() {
    // lundi de la semaine, 00:00 TZ
    return dayjs().tz(TZ).isoWeekday(1).startOf('day').format('YYYY-MM-DD');
}
export function isOutdated(weekStart) {
    if (!weekStart)
        return true;
    return weekStart !== currentWeekStart();
}
export function getWeekStartIso(date = new Date()) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // 0=lundi
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}
export function dayKeyFromDate(date = new Date()) {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][(date.getDay() + 6) % 7];
}
