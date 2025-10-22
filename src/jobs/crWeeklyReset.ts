import cron from 'node-cron';
import { readJson, writeJson } from '../utils/storage.js';
import { currentWeekStart } from '../utils/week.js';
import { makeEmbed } from '../utils/embed.js';
import { CR_DAYS, dayLabel } from '../utils/cr.js';
import { sendToChannel } from '../utils/send.js';
import type { Client } from 'discord.js';
import { discordAbsolute, discordDate } from '../utils/time.js';

// Type pour le stockage des oublis hebdomadaires
type WeekStore = {
  weekStart: string;
  days: { mon: string[]; tue: string[]; wed: string[]; thu: string[]; fri: string[]; sat: string[]; sun: string[]; };
};
const WEEK_PATH = 'src/data/crWeek.json';

// Types low-score
type LowEntry = { userId: string; score: number; note?: string };
type LowWeekStore = {
  weekStart: string;
  days: { mon: LowEntry[]; tue: LowEntry[]; wed: LowEntry[]; thu: LowEntry[]; fri: LowEntry[]; sat: LowEntry[]; sun: LowEntry[]; }
};
const LOW_PATH = 'src/data/crLow.json';

function buildWeeklyRecapEmbed(store: WeekStore) {
  // champs jour par jour
  const fields = (['mon','tue','wed','thu','fri','sat','sun'] as const).map(k => {
    const list = store.days[k];
    const text = list.length ? list.map(id => `<@${id}>`).join('\n') : '—';
    return { name: dayLabel(k), value: text, inline: true };
  });

  // mini top hebdo (qui a oublié le plus cette semaine)
  const counts = new Map<string, number>();
  for (const k of Object.keys(store.days) as Array<keyof WeekStore['days']>) {
    for (const uid of store.days[k]) counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  const topLines = [...counts.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0, 10)
    .map(([uid, n]) => `**${n}** — <@${uid}>`)
    .join('\n') || '—';

  const embed = makeEmbed({
    title: `🗓 Récap CR — semaine du ${discordAbsolute(store.weekStart, 'F')}`,
    description: 'Liste des oublis par jour (lun→dim) et top hebdo.',
    fields: [
      ...fields,
      { name: '🏆 Top hebdo (attention à la porte)', value: topLines }
    ],
    footer: 'Reset automatique chaque lundi à 02:15 (heure Paris)',
    timestamp: new Date(store.weekStart)
  });

  return embed;
}

function buildLowScoreEmbed(store: LowWeekStore) {
  const fields = (['mon','tue','wed','thu','fri','sat','sun'] as const).map(k => {
    const list = store.days[k];
    const text = list.length
      ? list.map(e => `• <@${e.userId}> — **${e.score}**${e.note ? ` — _${e.note}_` : ''}`).join('\n')
      : '—';
    return { name: dayLabel(k), value: text, inline: false };
  });

  return makeEmbed({
    title: `📉 Récap low scores — semaine du ${store.weekStart}`,
    timestamp: store.weekStart,
    fields,
    footer: 'Reset automatique chaque lundi à 02:15 (heure Paris)'
  });
}

export function registerWeeklyResetJob(client: Client) {
  const spec = process.env.CR_WEEKLY_RESET_CRON || '15 2 * * 1';
  const tz   = process.env.RESET_CRON_TZ || 'Europe/Paris';
  const channelId = process.env.CR_LOGS_CHANNEL_ID;

  cron.schedule(spec, async () => {
    try {

      // 1) Lire le stockage des oublis et low-scores de la semaine passée
      // store “oublis”
      const fallback: WeekStore = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      const store = await readJson<WeekStore>(WEEK_PATH, fallback);

      // store “low scores”
      const lowFallback: LowWeekStore = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      const low = await readJson<LowWeekStore>(LOW_PATH, lowFallback);

      // 2) Poster le récap si un salon est configuré
      if (channelId) {
        const embed = buildWeeklyRecapEmbed(store);
        await sendToChannel(client, channelId, { embeds: [embed] });

        const recapLow = buildLowScoreEmbed(low);
        await sendToChannel(client, channelId, { embeds: [recapLow] });
      }

      // 3) Réinitialiser les 2 fichiers de stockage (nouveau weekStart = ce lundi)
      const freshWeek: WeekStore = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      await writeJson(WEEK_PATH, freshWeek);

      const freshLow: LowWeekStore = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      await writeJson(LOW_PATH, freshLow);

      console.log('[CR] Weekly recap posted (oublis + low scores) & stores reset.');
    } catch (e) {
      console.error('[CR] Weekly reset job failed:', e);
    }
  }, { timezone: tz });
}
