const DAYS = {
    daily: '*',
    weekdays: '1-5',
    weekends: '6,0',
    mon: '1', tue: '2', wed: '3', thu: '4', fri: '5', sat: '6', sun: '0'
};
export function hhmmToSpec(hhmm, freq) {
    // "HH:MM" -> "MM HH * * <dow>"
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
    if (!m)
        return null;
    const [_, HH, MM] = m;
    const dow = DAYS[freq] ?? '*';
    return `${parseInt(MM, 10)} ${parseInt(HH, 10)} * * ${dow}`;
}
