import type { ChatInputCommandInteraction, Role, GuildMember } from 'discord.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js'; // 🆕 helper mirroring
import { pushLog } from '../http/logs.js';

function botCanManage(i: ChatInputCommandInteraction, role: Role) {
  const me = i.guild!.members.me;
  if (!me) return false;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
  // Bot must be higher than the target role
  return me.roles.highest.comparePositionTo(role) > 0;
}

function targetCheck(i: ChatInputCommandInteraction, target: GuildMember) {
  if (target.id === i.guild!.ownerId) return 'On ne peut pas modifier le propriétaire du serveur.';
  return null;
}

export const data = new SlashCommandBuilder()
  .setName('roleset')
  .setDescription('Gestion des rôles (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('swap')
    .setDescription('Remplace un rôle par un autre pour un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('from').setDescription('Rôle actuel à retirer').setRequired(true))
    .addRoleOption(o => o.setName('to').setDescription('Nouveau rôle à ajouter').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajoute un rôle à un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle à ajouter').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Retire un rôle à un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle à retirer').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['roleset'];
  // ✅ on ne fixe pas de canal ici : le helper gère ephemeral + miroir
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDefer(interaction); // 🆕 au lieu de interaction.deferReply({ ephemeral: true })

    const member = await interaction.guild!.members.fetch(
      interaction.options.getUser('membre', true).id
    );

    const block = targetCheck(interaction, member);
    if (block) return officerEdit(interaction, `❌ ${block}`);

    if (sub === 'swap') {
      const from = interaction.options.getRole('from', true) as Role;
      const to   = interaction.options.getRole('to', true) as Role;

      if (!botCanManage(interaction, from) || !botCanManage(interaction, to)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'roleset',
          msg: `[ROLESET] Bot cannot manage roles for swap: from=${from.id} to=${to.id}`,
          meta: { interactionId: interaction.id }
        });

        return officerEdit(interaction, '❌ Mon rôle n’est pas assez haut ou je n’ai pas **Manage Roles**.');
      }

      if (member.roles.cache.has(to.id) && !member.roles.cache.has(from.id)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'info',
          component: 'roleset',
          msg: `[ROLESET] Swap no-op: member already has 'to' role and lacks 'from' role`,
          meta: { interactionId: interaction.id, memberId: member.id, fromRoleId: from.id, toRoleId: to.id }
        });

        return officerEdit(interaction, 'ℹ️ Le membre a déjà le rôle cible et n’a pas le rôle source.');
      }

      if (member.roles.cache.has(from.id)) await member.roles.remove(from, 'roleset swap');
      if (!member.roles.cache.has(to.id)) await member.roles.add(to, 'roleset swap');

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'roleset',
        msg: `[ROLESET] Swapped roles for member`,
        meta: { interactionId: interaction.id, memberId: member.id, fromRoleId: from.id, toRoleId: to.id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '🔁 Rôle échangé',
          fields: [
            { name: 'Membre', value: `${member} (\`${member.id}\`)`, inline: false },
            { name: 'Retiré', value: `<@&${from.id}>`, inline: true },
            { name: 'Ajouté',  value: `<@&${to.id}>`, inline: true },
          ]
        })]
      });
    }

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true) as Role;
      if (!botCanManage(interaction, role)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'roleset',
          msg: `[ROLESET] Bot cannot manage role for add: role=${role.id}`,
          meta: { interactionId: interaction.id }
        });

        return officerEdit(interaction, '❌ Mon rôle n’est pas assez haut ou je n’ai pas **Manage Roles**.');
      }
      if (member.roles.cache.has(role.id)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'info',
          component: 'roleset',
          msg: `[ROLESET] Add no-op: member already has role`,
          meta: { interactionId: interaction.id, memberId: member.id, roleId: role.id }
        });

        return officerEdit(interaction, 'ℹ️ Le membre a déjà ce rôle.');
      }
      await member.roles.add(role, 'roleset add');
      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'roleset',
        msg: `[ROLESET] Added role to member`,
        meta: { interactionId: interaction.id, memberId: member.id, roleId: role.id }
      });

      return officerEdit(interaction, `✅ Rôle ajouté à ${member}: <@&${role.id}>`);
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true) as Role;
      if (!botCanManage(interaction, role)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'roleset',
          msg: `[ROLESET] Bot cannot manage role for remove: role=${role.id}`,
          meta: { interactionId: interaction.id }
        });

        return officerEdit(interaction, '❌ Mon rôle n’est pas assez haut ou je n’ai pas **Manage Roles**.');
      }
      if (!member.roles.cache.has(role.id)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'info',
          component: 'roleset',
          msg: `[ROLESET] Remove no-op: member does not have role`,
          meta: { interactionId: interaction.id, memberId: member.id, roleId: role.id }
        });

        return officerEdit(interaction, 'ℹ️ Le membre n’a pas ce rôle.');
      }
      await member.roles.remove(role, 'roleset remove');
      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'roleset',
        msg: `[ROLESET] Removed role from member`,
        meta: { interactionId: interaction.id, memberId: member.id, roleId: role.id }
      });

      return officerEdit(interaction, `✅ Rôle retiré à ${member}: <@&${role.id}>`);
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /roleset.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'roleset',
      msg: `[ROLESET] Error during execution`,
      meta: { interactionId: interaction.id, error: (e as Error).message }
    });
    return;
  }
}

export default { data, execute };
