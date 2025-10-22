import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { readJson, writeJson } from '../utils/storage.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';

type Report = {
  id: string;
  targetId: string;
  note: string;
  createdBy: string;
  createdAt: string; // ISO
};

const STORE = 'src/data/reports.json';

function newId() {
  const s = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const rnd = Math.random().toString(36).slice(2,6);
  return `rp_${s}_${rnd}`;
}

async function load(): Promise<Report[]> { return readJson<Report[]>(STORE, []); }
async function save(list: Report[]) { return writeJson(STORE, list); }

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

      const list = await load();
      const rep: Report = {
        id: newId(),
        targetId: user.id,
        note,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString(),
      };
      list.push(rep);
      await save(list);

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
          footer: new Date(rep.createdAt).toLocaleString()
        })]
      });
    }

    if (sub === 'list') {
      const target = interaction.options.getUser('membre');
      const list = await load();
      const filtered = target ? list.filter(r => r.targetId === target.id) : list;
      if (!filtered.length) {
        return officerEdit(interaction, target
          ? `Aucun signalement pour ${target}.`
          : 'Aucun signalement enregistré.');
      }

      // Limiter l’embed pour rester lisible (les 15 plus récents)
      const items = filtered.sort((a,b)=> b.createdAt.localeCompare(a.createdAt)).slice(0,15);
      const lines = items.map(r =>
        `• \`${r.id}\` — <@${r.targetId}> — par <@${r.createdBy}> — ${new Date(r.createdAt).toLocaleString()}\n  ↳ ${r.note}`
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
      const list = await load();
      const idx = list.findIndex(r => r.id === id);
      if (idx < 0) return officerEdit(interaction, '❌ ID introuvable.');

      const [rm] = list.splice(idx, 1);
      await save(list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'signalement',
        msg: `[SIGNALEMENT] Report ${rm.id} removed by ${interaction.user.id}`,
        meta: { report: rm, removedBy: interaction.user.id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '🗑️ Signalement supprimé',
          fields: [
            { name: 'ID', value: `\`${rm.id}\`` , inline: true },
            { name: 'Membre', value: `<@${rm.targetId}>`, inline: true },
            { name: 'Par', value: `<@${rm.createdBy}>`, inline: true },
          ],
          description: rm.note
        })]
      });
    }

  } catch (e) {
    console.error(e);
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

export default { data, execute };
