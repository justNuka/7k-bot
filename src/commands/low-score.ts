import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { readJson, writeJson } from '../utils/storage.js';
import { CR_DAYS, dayLabel } from '../utils/cr.js';
import { currentWeekStart, isOutdated } from '../utils/week.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { discordAbsolute } from '../utils/time.js';

// Helpers
import { crDefer, crEdit } from '../utils/crReply.js';   
import { pushLog } from '../http/logs.js';

type LowEntry = { userId: string; score: number; note?: string };
type LowWeekStore = {
  weekStart: string;
  days: { mon: LowEntry[]; tue: LowEntry[]; wed: LowEntry[]; thu: LowEntry[]; fri: LowEntry[]; sat: LowEntry[]; sun: LowEntry[]; }
};

const STORE_PATH = 'src/data/crLow.json';

async function loadWeek(): Promise<LowWeekStore> {
  const empty: LowWeekStore = {
    weekStart: currentWeekStart(),
    days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
  };
  const s = await readJson<LowWeekStore>(STORE_PATH, empty);
  if (isOutdated(s.weekStart)) return empty;
  return s;
}
async function saveWeek(s: LowWeekStore) { await writeJson(STORE_PATH, s); }

export const data = new SlashCommandBuilder()
  .setName('low-score')
  .setDescription('CR — journal des low scores (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajoute un low score pour un membre (officiers)')
    .addUserOption(o => o.setName('membre').setDescription('Membre concerné').setRequired(true))
    .addIntegerOption(o => o.setName('score').setDescription('Score réalisé').setRequired(true))
    .addStringOption(o => {
      let opt = o.setName('jour').setDescription('Jour du CR').setRequired(true);
      CR_DAYS.forEach(d => opt = opt.addChoices({ name: d.label, value: d.key }));
      return opt;
    })
    .addStringOption(o => o.setName('note').setDescription('Remarque (optionnel)'))
  )
  .addSubcommand(sc => sc
    .setName('week')
    .setDescription('Affiche le récap hebdo des low scores (lun→dim)')
  )
  .addSubcommand(sc => sc
    .setName('reset')
    .setDescription('Reset hebdo des low scores (officiers)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // 🔐 Rôle seulement (on n’impose plus un canal unique : mirroring géré par crReply utils)
  const rule = COMMAND_RULES['low-score'] ?? COMMAND_RULES['oubli-cr'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await crDefer(interaction);

    let store = await loadWeek();

    if (sub === 'add') {
      const user = interaction.options.getUser('membre', true);
      const score = interaction.options.getInteger('score', true);
      const jour = interaction.options.getString('jour', true) as keyof LowWeekStore['days'];
      const note = interaction.options.getString('note') ?? undefined;

      store.days[jour].push({ userId: user.id, score, note });
      await saveWeek(store);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Added low score: ${user.tag} — ${score} on ${jour} (by ${interaction.user.tag})`,
        meta: { userId: user.id, score, day: jour, by: interaction.user.id }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: `📉 Low score enregistré — semaine du ${discordAbsolute(store.weekStart, 'F')}`,
          fields: [
            { name: 'Membre', value: `<@${user.id}>`, inline: true },
            { name: 'Jour', value: dayLabel(jour), inline: true },
            { name: 'Score', value: String(score), inline: true },
            { name: 'Semaine', value: discordAbsolute(store.weekStart, 'F'), inline: true },
            ...(note ? [{ name: 'Note', value: note, inline: false }] : [])
          ],
          timestamp: new Date(store.weekStart)
        })]
      });
    }

    if (sub === 'week') {
      const fields = (['mon','tue','wed','thu','fri','sat','sun'] as const).map(k => {
        const list = store.days[k];
        const text = list.length
          ? list.map(e => `• <@${e.userId}> — **${e.score}**${e.note ? ` — _${e.note}_` : ''}`).join('\n')
          : '—';
        return { name: dayLabel(k), value: text, inline: false };
      });

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Week summary requested (by ${interaction.user.tag})`,
        meta: { by: interaction.user.id }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: `🗓 Low scores — semaine du ${store.weekStart}`,
          timestamp: store.weekStart,
          fields
        })]
      });
    }

    if (sub === 'reset') {
      store = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      await saveWeek(store);
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Weekly low scores reset (by ${interaction.user.tag})`,
        meta: { by: interaction.user.id }
      });
      return crEdit(interaction, `🧹 Low scores hebdo réinitialisés (semaine du ${discordAbsolute(store.weekStart, 'f')}).`);
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /low-score.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'low-score',
      msg: `[LOW-SCORE] Error executing low-score command (by ${interaction.user.tag})`,
      meta: { by: interaction.user.id, error: String(e) }
    });
    return;
  }
}

export default { data, execute };
