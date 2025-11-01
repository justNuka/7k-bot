/**
 * Parse une date depuis plusieurs formats intuitifs
 * Formats acceptés :
 * - YYYY-MM-DD (format actuel)
 * - DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
 * - "aujourd'hui", "demain", "après-demain"
 * - "lundi", "mardi", etc. (prochain jour de la semaine)
 * - "dans X jours/semaines"
 * - "lundi 4 novembre" ou "4 novembre" (année courante)
 * - "4 nov" ou "04/11" (année courante)
 */
const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MOIS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];
const MOIS_COURT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
/**
 * Parse une date et retourne YYYY-MM-DD ou null si invalide
 */
export function parseDate(input) {
    if (!input)
        return null;
    const cleaned = input.trim().toLowerCase();
    const now = new Date();
    // Format YYYY-MM-DD (actuel)
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        const d = new Date(cleaned + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return cleaned;
        }
    }
    // Format DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return formatDate(new Date(Number(year), Number(month) - 1, Number(day)));
    }
    // Format DD/MM (année courante)
    const dmMatch = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
    if (dmMatch) {
        const [, day, month] = dmMatch;
        const year = now.getFullYear();
        return formatDate(new Date(year, Number(month) - 1, Number(day)));
    }
    // Mots-clés rapides
    if (cleaned === 'aujourd\'hui' || cleaned === 'aujourdhui' || cleaned === 'auj') {
        return formatDate(now);
    }
    if (cleaned === 'demain' || cleaned === 'dem') {
        return formatDate(addDays(now, 1));
    }
    if (cleaned === 'après-demain' || cleaned === 'apres-demain' || cleaned === 'apres demain') {
        return formatDate(addDays(now, 2));
    }
    // "dans X jours/semaines"
    const dansMatch = cleaned.match(/^dans (\d+) (jour|jours|semaine|semaines)$/);
    if (dansMatch) {
        const [, nb, unite] = dansMatch;
        const days = unite.startsWith('semaine') ? Number(nb) * 7 : Number(nb);
        return formatDate(addDays(now, days));
    }
    // Jour de la semaine (prochain)
    const jourIdx = JOURS_SEMAINE.indexOf(cleaned);
    const jourCourtIdx = JOURS_COURT.indexOf(cleaned);
    if (jourIdx >= 0 || jourCourtIdx >= 0) {
        const targetDay = jourIdx >= 0 ? jourIdx : jourCourtIdx;
        return formatDate(getNextWeekday(now, targetDay));
    }
    // "4 novembre" ou "4 nov" (année courante)
    const dayMonthMatch = cleaned.match(/^(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|jan|fév|fev|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc|dec)$/);
    if (dayMonthMatch) {
        const [, day, monthStr] = dayMonthMatch;
        const monthIdx = MOIS.indexOf(monthStr) >= 0
            ? MOIS.indexOf(monthStr)
            : MOIS_COURT.indexOf(monthStr);
        if (monthIdx >= 0) {
            const year = now.getFullYear();
            return formatDate(new Date(year, monthIdx, Number(day)));
        }
    }
    // "lundi 4 novembre" ou "lun 4 nov"
    const weekdayDayMonthMatch = cleaned.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\s+(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|jan|fév|fev|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc|dec)$/);
    if (weekdayDayMonthMatch) {
        const [, , day, monthStr] = weekdayDayMonthMatch;
        const monthIdx = MOIS.indexOf(monthStr) >= 0
            ? MOIS.indexOf(monthStr)
            : MOIS_COURT.indexOf(monthStr);
        if (monthIdx >= 0) {
            const year = now.getFullYear();
            return formatDate(new Date(year, monthIdx, Number(day)));
        }
    }
    return null;
}
/**
 * Formate une Date en YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * Ajoute des jours à une date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
/**
 * Retourne la prochaine occurrence d'un jour de la semaine (0=dim, 6=sam)
 */
function getNextWeekday(from, targetDay) {
    const result = new Date(from);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0)
        daysToAdd += 7; // Si c'est aujourd'hui ou passé, on prend la semaine prochaine
    result.setDate(result.getDate() + daysToAdd);
    return result;
}
/**
 * Génère des suggestions d'autocomplete pour les dates
 */
export function getDateSuggestions(focused) {
    const now = new Date();
    const suggestions = [];
    // Toujours proposer les raccourcis courants
    const quickOptions = [
        { name: '📅 Aujourd\'hui', value: 'aujourd\'hui' },
        { name: '📅 Demain', value: 'demain' },
        { name: '📅 Après-demain', value: 'après-demain' },
    ];
    // Ajouter les 7 prochains jours de la semaine
    for (let i = 1; i <= 7; i++) {
        const date = addDays(now, i);
        const dayName = JOURS_SEMAINE[date.getDay()];
        const formatted = formatDate(date);
        quickOptions.push({
            name: `📅 ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${date.getDate()}/${date.getMonth() + 1}`,
            value: dayName
        });
    }
    // Si l'utilisateur tape quelque chose, on filtre
    if (focused && focused.length > 0) {
        const lower = focused.toLowerCase();
        const filtered = quickOptions.filter(opt => opt.name.toLowerCase().includes(lower) || opt.value.toLowerCase().includes(lower));
        suggestions.push(...filtered.slice(0, 25));
    }
    else {
        suggestions.push(...quickOptions.slice(0, 25));
    }
    return suggestions;
}
/**
 * Formate une date lisible pour l'utilisateur (ex: "Lundi 4 novembre 2025")
 */
export function formatDateReadable(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime()))
        return dateStr;
    const dayName = JOURS_SEMAINE[date.getDay()];
    const monthName = MOIS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} ${monthName} ${year}`;
}
