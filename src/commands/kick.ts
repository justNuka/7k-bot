import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess, botCanManageRole } from '../utils/discord/access.js';
import { officerDeferPublic, officerEdit } from '../utils/formatting/officerReply.js';
import { KICK_TEMPLATES } from '../config/kickTemplates.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { pushLog } from '../http/logs.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:kick');

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Envoyer un message de sortie de guilde (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('send')
    .setDescription('Notifier un membre avec un message formaté')
    .addUserOption(o => o.setName('membre').setDescription('Membre ciblé').setRequired(true))
    .addStringOption(o => {
      let opt = o.setName('raison')
        .setDescription('Modèle de message')
        .setRequired(true);
      KICK_TEMPLATES.forEach(t => opt = opt.addChoices({ name: t.label, value: t.id }));
      return opt;
    })
    .addStringOption(o => o.setName('note').setDescription('Note optionnelle ajoutée à la fin'))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['roleset'] ?? { roles: [ROLE_IDS.OFFICIERS], channels: [] }; // même garde que roleset
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);
  try {
    await officerDeferPublic(interaction);

    if (sub === 'send') {
      const user = interaction.options.getUser('membre', true);
      const reasonId = interaction.options.getString('raison', true);
      const note = interaction.options.getString('note') ?? '';

      const tpl = KICK_TEMPLATES.find(t => t.id === reasonId);
      if (!tpl) return officerEdit(interaction, '❌ Modèle introuvable.');

      const body = tpl.body
        .replaceAll('{member}', `<@${user.id}>`)
        .replaceAll('{note}', note ? `**Note :** ${note}` : '');

      const emb = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle(tpl.title)
        .setDescription(body)
        .setFooter({ text: 'Message d’information — 7K Rebirth' })
        .setTimestamp();

      // 1) DM au membre (best effort)
      let dmOk = true;
      try {
        const dm = await user.createDM();
        await dm.send({ embeds: [emb] });
      } catch {
        dmOk = false;
      }

      // 2) Changement de rôles (membres -> visiteurs)
      let roleChangeNote = '—';
      try {
        const guild = interaction.guild!;
        const member = await guild.members.fetch(user.id).catch(() => null);
        const rM = ROLE_IDS.MEMBRES;
        const rV = ROLE_IDS.VISITEURS;

        if (!member) {
          roleChangeNote = '⚠️ Membre introuvable sur le serveur (peut-être a déjà quitté).';
          pushLog({
            ts: new Date().toISOString(),
            level: 'warn',
            component: 'kick',
            msg: `Membre introuvable sur /kick send par ${interaction.user.tag} (${interaction.user.id}) pour ${user.tag} (${user.id})`,
            meta: { moderatorId: interaction.user.id, targetId: user.id },
          });
        } else if (!rM || !rV) {
          roleChangeNote = '⚠️ ROLE_MEMBRES_ID / ROLE_VISITEURS_ID non configurés.';
          pushLog({
            ts: new Date().toISOString(),
            level: 'error',
            component: 'kick',
            msg: `ROLE_MEMBRES_ID /
  ROLE_VISITEURS_ID non configurés sur /kick send par ${interaction.user.tag} (${interaction.user.id})`,
            meta: { moderatorId: interaction.user.id, targetId: user.id },
          });
        } else if (!botCanManageRole(interaction, rM) || !botCanManageRole(interaction, rV)) {
          roleChangeNote = '⚠️ Mon rôle est trop bas ou je n’ai pas **Manage Roles**.';
          pushLog({
            ts: new Date().toISOString(),
            level: 'error',
            component: 'kick',
            msg: `Permissions insuffisantes pour gérer les rôles sur /kick send par ${interaction.user.tag} (${interaction.user.id})`,
            meta: { moderatorId: interaction.user.id, targetId: user.id },
          });
        } else {
          const ops: string[] = [];
          if (member.roles.cache.has(rM)) {
            await member.roles.remove(rM, 'kick: retrait rôle membres');
            ops.push(`retiré <@&${rM}>`);
            pushLog({
              ts: new Date().toISOString(),
              level: 'info',
              component: 'kick',
              msg: `Retrait du rôle membres sur /kick send par ${interaction.user.tag} (${interaction.user.id}) pour ${user.tag} (${user.id})`,
              meta: { moderatorId: interaction.user.id, targetId: user.id },
            });
          }
          if (!member.roles.cache.has(rV)) {
            await member.roles.add(rV, 'kick: ajout rôle visiteurs');
            ops.push(`ajouté <@&${rV}>`);
            pushLog({
              ts: new Date().toISOString(),
              level: 'info',
              component: 'kick',
              msg: `Ajout du rôle visiteurs sur /kick send par ${interaction.user.tag} (${interaction.user.id}) pour ${user.tag} (${user.id})`,
              meta: { moderatorId: interaction.user.id, targetId: user.id },
            });
          }
          roleChangeNote = ops.length ? ops.join(' / ') : 'Aucun changement (déjà visiteurs, pas membres).';
          pushLog({
            ts: new Date().toISOString(),
            level: 'info',
            component: 'kick',
            msg: `Changement de rôles sur /kick send par ${interaction.user.tag} (${interaction.user.id}) pour ${user.tag} (${user.id}): ${roleChangeNote}`,
            meta: { moderatorId: interaction.user.id, targetId: user.id, operations: ops },
          });
        }
      } catch (e) {
        log.error({ error: e, moderatorId: interaction.user.id, targetId: user.id }, 'Erreur roleswap kick');
        roleChangeNote = '⚠️ Erreur pendant le changement de rôles.';
        pushLog({
          ts: new Date().toISOString(),
          level: 'error',
          component: 'kick',
          msg: `Erreur pendant le changement de rôles sur /kick send par ${interaction.user.tag} (${interaction.user.id})`,
          meta: { userId: interaction.user.id, targetId: user.id, error: String(e) },
        });
      }

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'kick',
        msg: `/kick send utilisé par ${interaction.user.tag} (${interaction.user.id}) pour ${user.tag} (${user.id})`,
        meta: { moderatorId: interaction.user.id, targetId: user.id, templateId: tpl.id, dmOk, roleChangeNote },
      });

      // 3) Retour à l’officier + log
      await officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '📨 Message envoyé via la commande `/kick send`',
          fields: [
            { name: 'Modérateur', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Membre', value: `<@${user.id}>`, inline: true },
            { name: 'Modèle', value: tpl.label, inline: true },
            { name: 'DM', value: dmOk ? '✅ OK' : '⚠️ Impossible (DM du joueur fermés)', inline: true },
            ...(note ? [{ name: 'Note', value: note }] : []),
            { name: 'Changement de rôles', value: roleChangeNote },
          ]
        })]
      });
    }

  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /kick');
    await safeError(interaction, 'Erreur sur /kick send.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'kick',
      msg: `Erreur sur /kick send par ${interaction.user.tag} (${interaction.user.id})`,
      meta: { userId: interaction.user.id, error: String(e) },
    });
  }
}

export default { data, execute };
