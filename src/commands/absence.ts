import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);

import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { officerDefer, officerEdit } from '../utils/formatting/officerReply.js';
import { daysLeftInclusive, discordAbsolute, discordRelative } from '../utils/time/time.js';
import { pushLog } from '../http/logs.js';
import { parseDate, getDateSuggestions, formatDateReadable } from '../utils/time/dateParser.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:absence');

// DB
import { insertAbsence, listActiveAbsences } from '../db/absences.js';

const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

export const data = new SlashCommandBuilder()
  .setName('absence')
  .setDescription('Déclaration et suivi des absences')
  .setDMPermission(false)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Déclarer une absence (membre)')
    .addStringOption(o => o
      .setName('debut')
      .setDescription('Date de début (ex: "demain", "lundi", "15/11/2025")')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o
      .setName('fin')
      .setDescription('Date de fin (ex: "vendredi", "dans 5 jours", "20/11/2025")')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)'))
    .addStringOption(o => o.setName('note').setDescription('Note (optionnel)'))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister les absences (officiers)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);

  try {
    if (sub === 'add') {
      // Ouvert à tous
      await interaction.deferReply({ ephemeral: true });

      const debutInput = interaction.options.getString('debut', true);
      const finInput   = interaction.options.getString('fin', true);
      const reason = interaction.options.getString('raison') ?? undefined;
      const note   = interaction.options.getString('note') ?? undefined;

      // Parser les dates avec le nouveau système
      const debut = parseDate(debutInput);
      const fin = parseDate(finInput);
      
      if (!debut) return interaction.editReply(`❌ Date de début invalide : "${debutInput}"\n💡 Formats acceptés : "demain", "lundi", "15/11/2025", "15 novembre", etc.`);
      if (!fin) return interaction.editReply(`❌ Date de fin invalide : "${finInput}"\n💡 Formats acceptés : "vendredi", "dans 5 jours", "20/11/2025", etc.`);

      const s = dayjs.tz(debut, 'YYYY-MM-DD', TZ);
      const e = dayjs.tz(fin,   'YYYY-MM-DD', TZ);
      if (!s.isValid() || !e.isValid()) return interaction.editReply('❌ Dates invalides après parsing.');
      if (e.isBefore(s)) return interaction.editReply('❌ La date de fin doit être **après ou égale** à la date de début.');

      const row = insertAbsence({
        userId: interaction.user.id,
        startIso: s.toISOString(),
        endIso: e.toISOString(),
        reason, note
      });

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'absence',
        msg: `Absence ajoutée pour <@${interaction.user.id}>`,
        meta: { id: row.id, start: row.start_iso, end: row.end_iso, reason: row.reason || null }
      });

      return interaction.editReply({
        embeds: [makeEmbed({
          title: '📝 Absence enregistrée',
          fields: [
            { name: 'Période', value: `${discordAbsolute(row.start_iso, 'F')} → ${discordAbsolute(row.end_iso, 'F')}`, inline: false },
            ...(row.reason ? [{ name: 'Raison', value: row.reason, inline: true }] : []),
            ...(row.note   ? [{ name: 'Note',   value: row.note,   inline: false }] : []),
          ]
        })]
      });
    }

    if (sub === 'list') {
      // Officiers only
      const rule = COMMAND_RULES['roleset'] ?? { roles: [ROLE_IDS.OFFICIERS], channels: [] };
      if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

      await officerDefer(interaction); // smart (ephemeral hors salon officiers)

      const items = listActiveAbsences();
      if (!items.length) return officerEdit(interaction, 'Aucune absence en cours / à venir.');

      const rows = items.map(a => {
        const finAbs = discordAbsolute(a.end_iso, 'D');
        const finRel = discordRelative(a.end_iso);
        const left   = daysLeftInclusive(a.end_iso, TZ);
        const span   = `${discordAbsolute(a.start_iso,'D')} → ${discordAbsolute(a.end_iso,'D')}`;

        const parts = [
          `• <@${a.user_id}> — ${span}`,
          `fin: ${finAbs} ${finRel}`,
          `restants: **${left}**j`
        ];
        if (a.reason) parts.push(`_${a.reason}_`);
        return parts.join(' — ');
      });

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'absence',
        msg: `Liste des absences consultée par <@${interaction.user.id}>`,
        meta: { count: items.length }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: `📅 Absences en cours / à venir (${items.length})`,
          description: rows.join('\n')
        })]
      });
    }

  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /absence');
    await safeError(interaction, 'Erreur sur /absence.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'absence',
      msg: `Erreur sur /absence pour <@${interaction.user.id}>`,
      meta: { error: (e as Error).message }
    });
  }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  
  if (focused.name === 'debut' || focused.name === 'fin') {
    const suggestions = getDateSuggestions(focused.value);
    return interaction.respond(suggestions);
  }
  
  return interaction.respond([]);
}

export default { data, execute, autocomplete };
