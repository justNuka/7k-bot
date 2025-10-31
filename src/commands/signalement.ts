import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { officerDefer, officerEdit } from '../utils/formatting/officerReply.js';
import { pushLog } from '../http/logs.js';
import { insertReport, listAllReports, listReportsByUser, deleteReport, getReport } from '../db/reports.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:signalement');

type Report = {
  id: string;
  targetId: string;
  note: string;
  createdBy: string;
  createdAt: string; // ISO
};

function newId() {
  const s = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const rnd = Math.random().toString(36).slice(2,6);
  return `rp_${s}_${rnd}`;
}

export const data = new SlashCommandBuilder()
  .setName('signalement')
  .setDescription('Gestion des signalements (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajouter un signalement pour un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre concerné').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Raison / détails').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister les signalements (optionnel: filtrer par membre)')
    .addUserOption(o => o.setName('membre').setDescription('Filtrer par membre'))
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprimer un signalement par ID')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID du signalement')
      .setRequired(true)
      .setAutocomplete(true)
    )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['signalement'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDefer(interaction);

    if (sub === 'add') {
      const user = interaction.options.getUser('membre', true);
      const note = interaction.options.getString('note', true);

      const rep = {
        id: newId(),
        target_id: user.id,
        note,
        created_by: interaction.user.id,
        created_at: new Date().toISOString(),
      };
      insertReport(rep);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'signalement',
        msg: `[SIGNALEMENT] New report ${rep.id} for ${user.id} by ${interaction.user.id}`,
        meta: { report: rep }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '🧾 Signalement ajouté',
          fields: [
            { name: 'Membre', value: `<@${user.id}>`, inline: true },
            { name: 'Par', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'ID', value: `\`${rep.id}\`` , inline: true },
          ],
          description: `**Note :** ${note}`,
          footer: new Date(rep.created_at).toLocaleString()
        })]
      });
    }

    if (sub === 'list') {
      const target = interaction.options.getUser('membre');
      const list = target ? listReportsByUser(target.id) : listAllReports();
      if (!list.length) {
        return officerEdit(interaction, target
          ? `Aucun signalement pour ${target}.`
          : 'Aucun signalement enregistré.');
      }

      const items = list.slice(0, 15);
      const lines = items.map(r =>
        `• \`${r.id}\` — <@${r.target_id}> — par <@${r.created_by}> — ${new Date(r.created_at).toLocaleString()}\n  ↳ ${r.note}`
      ).join('\n');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'signalement',
        msg: `[SIGNALEMENT] Listing ${items.length} reports${target ? ` for ${target.id}` : ''}`,
        meta: { count: items.length, targetId: target?.id }
      });

      return officerEdit(interaction, { embeds: [makeEmbed({
        title: `📋 Signalements ${target ? `— ${target.username}` : ''}`,
        description: lines
      })]});
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      const exists = getReport(id);
      if (!exists) return officerEdit(interaction, '❌ ID introuvable.');

      const changes = deleteReport(id);
      if (!changes) return officerEdit(interaction, '❌ Rien supprimé (déjà supprimé ?)');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'signalement',
        msg: `[SIGNALEMENT] Report ${id} removed by ${interaction.user.id}`,
        meta: { report: exists, removedBy: interaction.user.id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '🗑️ Signalement supprimé',
          fields: [
            { name: 'ID', value: `\`${exists.id}\`` , inline: true },
            { name: 'Membre', value: `<@${exists.target_id}>`, inline: true },
            { name: 'Par', value: `<@${exists.created_by}>`, inline: true },
          ],
          description: exists.note
        })]
      });
    }

  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /signalement');
    await safeError(interaction, 'Erreur sur /signalement.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'signalement',
      msg: '[SIGNALEMENT] Command error',
      meta: { error: (e as Error).message }
    });
    return;
  }
}

export async function autocomplete(interaction: import('discord.js').AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  
  if (focused.name === 'id') {
    const reports = listAllReports();
    const q = String(focused.value || '').toLowerCase();
    const items = reports
      .slice(0, 25)
      .map((r) => ({
        name: `${r.id} — ${r.note.slice(0, 40)}`,
        value: r.id
      }))
      .filter((c) => !q || c.name.toLowerCase().includes(q));
    await interaction.respond(items);
  }
}

export default { data, execute, autocomplete };
