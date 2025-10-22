export const CR_DAYS = [
  { key: 'mon',  label: 'Lundi (Rudy)',     boss: 'Rudy' },
  { key: 'tue',  label: 'Mardi (Eileene)',     boss: 'Eileene' },
  { key: 'wed',  label: 'Mercredi (Rachel)',  boss: 'Rachel' },
  { key: 'thu',  label: 'Jeudi (Dellons)',     boss: 'Dellons' },
  { key: 'fri',  label: 'Vendredi (Jave)',  boss: 'Jave' },
  { key: 'sat',  label: 'Samedi (Spike)',    boss: 'Spike' },
  { key: 'sun',  label: 'Dimanche (Kriss)',  boss: 'Kriss' },
];

export function dayLabel(key: string) {
  return CR_DAYS.find(d => d.key === key)?.label ?? key;
}
