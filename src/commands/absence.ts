import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);

import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { readJson, writeJson } from '../utils/storage.js';
import { COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js';
import { daysLeftInclusive, discordAbsolute, discordRelative } from '../utils/time.js';
import { pushLog } from '../http/logs.js';

const STORE = 'src/data/absences.json';
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

type Absence = {
  id: string;
  userId: string;
  start: string; // ISO
  end: string;   // ISO (inclusif)
  reason?: string;
  note?: string;
  createdAt: string; // ISO
};

type Store = { items: Absence[] };

function newId() {
  const stamp = dayjs().format('YYYYMMDD_HHmmss');
  const rnd = Math.random().toString(36).slice(2,6);
  return `abs_${stamp}_${rnd}`;
}
async function load(): Promise<Store>  { return readJson<Store>(STORE, { items: [] }); }
async function save(s: Store) { return writeJson(STORE, s); }

export const data = new SlashCommandBuilder()
  .setName('absence')
  .setDescription('Déclaration et suivi des absences')
  .setDMPermission(false)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Déclarer une absence (membre)')
    .addStringOption(o => o.setName('debut').setDescription('Date de début (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o => o.setName('fin').setDescription('Date de fin (YYYY-MM-DD)').setRequired(true))
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
      // Accessible à tous (membres/visiteurs/recrues) => pas de requireAccess spécial ici
      await interaction.deferReply({ ephemeral: true });

      const debut = interaction.options.getString('debut', true);
      const fin   = interaction.options.getString('fin', true);
      const reason = interaction.options.getString('raison') ?? undefined;
      const note   = interaction.options.getString('note') ?? undefined;

      const s = dayjs.tz(debut, 'YYYY-MM-DD', TZ);
      const e = dayjs.tz(fin,   'YYYY-MM-DD', TZ);
      if (!s.isValid() || !e.isValid()) return interaction.editReply('❌ Dates invalides (format: `YYYY-MM-DD`).');
      if (e.isBefore(s)) return interaction.editReply('❌ La date de fin doit être **après ou égale** à la date de début.');

      const store = await load();
      const abs: Absence = {
        id: newId(),
        userId: interaction.user.id,
        start: s.toISOString(),
        end: e.toISOString(),
        reason, note,
        createdAt: new Date().toISOString(),
      };
      store.items.push(abs);
      await save(store);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'absence',
        msg: `Absence ajoutée pour <@${interaction.user.id}>`,
        meta: { id: abs.id, start: abs.start, end: abs.end, reason: abs.reason || null }
      });

      return interaction.editReply({
        embeds: [makeEmbed({
          title: '📝 Absence enregistrée',
          fields: [
            { name: 'Période', value: `${discordAbsolute(abs.start, 'F')} → ${discordAbsolute(abs.end, 'F')}`, inline: false },
            ...(reason ? [{ name: 'Raison', value: reason, inline: true }] : []),
            ...(note   ? [{ name: 'Note',   value: note,   inline: false }] : []),
          ]
        })]
      });
    }

    if (sub === 'list') {
      // Garde officiers
      const rule = COMMAND_RULES['roleset'] ?? { roles: [ROLE_IDS.OFFICIERS], channels: [] };
      if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

      await officerDefer(interaction); // smart (ephemeral hors salon officiers)

      const store = await load();
      if (!store.items.length) return officerEdit(interaction, 'Aucune absence enregistrée.');

      // on affiche trié par date de début
      const rows = store.items
        .sort((a,b)=> a.start.localeCompare(b.start))
        .map(a => {
          const finAbs = discordAbsolute(a.end, 'D');      // ex: 20 Oct 2025
          const finRel = discordRelative(a.end);           // ex: (dans 3 jours)
          const left   = daysLeftInclusive(a.end, TZ);     // ex: 3
          const span   = `${discordAbsolute(a.start,'D')} → ${discordAbsolute(a.end,'D')}`;

          const parts = [
            `• <@${a.userId}> — ${span}`,
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
        meta: { count: store.items.length }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: `📅 Absences en cours (${store.items.length})`,
          description: rows.join('\n')
        })]
      });
    }

  } catch (e) {
    console.error(e);
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

export default { data, execute };
