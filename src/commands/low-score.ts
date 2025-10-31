// src/commands/lowScore.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { CR_DAYS, dayLabel } from '../utils/cr/cr.js';
import { getWeekStartIso } from '../utils/time/week.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { discordAbsolute } from '../utils/time/time.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:low-score');
import { addLowScore } from '../db/crWrites.js';
import { db } from '../db/db.js';

// Helpers (déjà existants chez toi)
import { crDefer, crEdit } from '../utils/cr/crReply.js';
import { pushLog } from '../http/logs.js';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

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
  // 🔐 Accès (rôles/canaux) – même logique que tes autres commandes
  const rule = COMMAND_RULES['low-score'] ?? COMMAND_RULES['oubli-cr'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await crDefer(interaction);

    const weekStart = getWeekStartIso(new Date()); // YYYY-MM-DD pour la semaine courante

    if (sub === 'add') {
      const user = interaction.options.getUser('membre', true);
      const score = interaction.options.getInteger('score', true);
      const jour = interaction.options.getString('jour', true) as DayKey;
      const note = interaction.options.getString('note') ?? undefined;

      // Écrit directement en DB (table low_week)
      addLowScore(weekStart, jour, user.id, score, note);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Add ${user.tag} — ${score} on ${jour} (by ${interaction.user.tag})`,
        meta: { userId: user.id, score, day: jour, by: interaction.user.id, weekStart }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: `📉 Low score enregistré — semaine du ${discordAbsolute(weekStart, 'F')}`,
          fields: [
            { name: 'Membre', value: `<@${user.id}>`, inline: true },
            { name: 'Jour', value: dayLabel(jour), inline: true },
            { name: 'Score', value: String(score), inline: true },
            ...(note ? [{ name: 'Note', value: note, inline: false }] : []),
          ],
          timestamp: new Date(weekStart)
        })]
      });
    }

    if (sub === 'week') {
      // Lecture DB -> groupé par jour
      const rows = db.prepare(
        'SELECT day, user_id, score, note FROM low_week WHERE week_start = ? ORDER BY day'
      ).all(weekStart) as Array<{day: DayKey; user_id: string; score: number; note?: string | null}>;

      const map: Record<DayKey, Array<{ userId: string; score: number; note?: string | null }>> = {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
      };
      for (const r of rows) map[r.day].push({ userId: r.user_id, score: r.score, note: r.note ?? null });

      const fields = (['mon','tue','wed','thu','fri','sat','sun'] as const).map(k => {
        const list = map[k];
        const text = list.length
          ? list.map(e => `• <@${e.userId}> — **${e.score}**${e.note ? ` — _${e.note}_` : ''}`).join('\n')
          : '—';
        return { name: dayLabel(k), value: text, inline: false };
      });

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Week summary (by ${interaction.user.tag})`,
        meta: { by: interaction.user.id, weekStart }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: `🗓 Low scores — semaine du ${discordAbsolute(weekStart, 'F')}`,
          timestamp: new Date(weekStart),
          fields
        })]
      });
    }

    if (sub === 'reset') {
      // on ne “réinitialise” plus un store mémoire : on vide la table pour la semaine
      db.prepare('DELETE FROM low_week WHERE week_start = ?').run(weekStart);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'low-score',
        msg: `[LOW-SCORE] Weekly reset (by ${interaction.user.tag})`,
        meta: { by: interaction.user.id, weekStart }
      });

      return crEdit(
        interaction,
        `🧹 Low scores hebdo réinitialisés (semaine du ${discordAbsolute(weekStart, 'f')}).`
      );
    }

  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /low-score');
    await safeError(interaction, 'Erreur sur /low-score.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'low-score',
      msg: `[LOW-SCORE] Error executing low-score (by ${interaction.user.tag})`,
      meta: { by: interaction.user.id, error: String(e) }
    });
  }
}

export default { data, execute };
