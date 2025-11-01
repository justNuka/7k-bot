/**
 * Utils d'affichage de dates pour Discord.
 *
 * Formats disponibles :
 * - `discordAbsolute(date)` → affiche la date absolue (localisée côté lecteur)
 * - `discordRelative(date)` → affiche uniquement la distance ("dans 2h", "il y a 3j")
 * - `discordDate(date)` → affiche les deux : absolu + relatif
 *
 * Discord prend en charge les formats :
 *   t = court, T = long (heure seule)
 *   d = court, D = long (date seule)
 *   f = court, F = long (date + heure)
 */
import dayjs from "dayjs";
/** Convertit vers timestamp Unix (secondes). Retourne null si invalide. */
export function toUnixSeconds(d) {
    if (d === null || d === undefined)
        return null;
    if (typeof d === 'number') {
        // déjà en secondes ? (<= 1e11 on considère secs)
        if (d < 1e11)
            return Math.floor(d);
        // sinon millis → secs
        return Math.floor(d / 1000);
    }
    const ms = Date.parse(String(d));
    if (!Number.isFinite(ms))
        return null;
    return Math.floor(ms / 1000);
}
/**
 * Rendu absolu uniquement.
 * Exemple : `<t:1734393600:F>`
 */
export function discordAbsolute(date, format = 'F', placeholder = '—') {
    const ts = toUnixSeconds(date);
    return ts === null ? placeholder : `<t:${ts}:${format}>`;
}
/**
 * Rendu relatif uniquement.
 * Exemple : `<t:1734393600:R>` → "dans 2 heures" / "il y a 1 jour"
 */
export function discordRelative(date, placeholder = '—') {
    const ts = toUnixSeconds(date);
    return ts === null ? placeholder : `<t:${ts}:R>`;
}
/**
 * Rendu combiné : absolu + relatif.
 * Exemple : `<t:...:F> (<t:...:R>)`
 */
export function discordDate(date, format = 'F', placeholder = '—') {
    const ts = toUnixSeconds(date);
    return ts === null ? placeholder : `<t:${ts}:${format}> (<t:${ts}:R>)`;
}
export function daysLeftInclusive(endISO, tz) {
    const today = dayjs().tz(tz).startOf('day');
    const end = dayjs(endISO).tz(tz).startOf('day');
    const diff = end.diff(today, 'day'); // ex: today=20, end=22 => 2
    return diff >= 0 ? diff + 1 : 0; // inclusif: 20..22 => 3 jours restants
}
