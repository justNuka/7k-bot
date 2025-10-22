import type { ChatInputCommandInteraction, Role, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { hhmmToSpec } from '../utils/cron.js';
import { loadNotifs, reloadAllNotifs, saveNotifs, startNotifTask, stopNotifTask, type Notif } from '../jobs/notifs.js';
import { sendToChannel } from '../utils/send.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js'; // 🆕 mirroring helper
import { pushLog } from '../http/logs.js';

function newId() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const rnd = Math.random().toString(36).slice(2,6);
  return `nf_${stamp}_${rnd}`;
}

export const data = new SlashCommandBuilder()
  .setName('notif')
  .setDescription('Système de notifications (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajouter une notification planifiée')
    .addRoleOption(o => o.setName('role').setDescription('Rôle à ping').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Salon où poster').addChannelTypes(
      ChannelType.GuildText, ChannelType.GuildAnnouncement
    ).setRequired(true))
    .addStringOption(o => o.setName('heure').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption(o => o.setName('freq').setDescription('Fréquence').setRequired(true).addChoices(
      { name: 'quotidien', value: 'daily' },
      { name: 'jours ouvrés (lun–ven)', value: 'weekdays' },
      { name: 'week-end (sam, dim)', value: 'weekends' },
      { name: 'lundi', value: 'mon' }, { name: 'mardi', value: 'tue' }, { name: 'mercredi', value: 'wed' },
      { name: 'jeudi', value: 'thu' }, { name: 'vendredi', value: 'fri' }, { name: 'samedi', value: 'sat' }, { name: 'dimanche', value: 'sun' }
    ))
    .addStringOption(o => o.setName('message').setDescription('Message (utilise <@&ROLE> pour ping)'))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister les notifications actives')
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprimer une notification')
    .addStringOption(o => o.setName('id').setDescription('ID de la notif').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('test')
    .setDescription('Tester une notification (envoi immédiat)')
    .addStringOption(o => o.setName('id').setDescription('ID de la notif').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('edit')
    .setDescription('Modifier une notification')
    .addStringOption(o => o.setName('id').setDescription('ID de la notif').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Nouveau rôle (optionnel)'))
    .addChannelOption(o => o.setName('channel').setDescription('Nouveau salon (optionnel)').addChannelTypes(
      ChannelType.GuildText, ChannelType.GuildAnnouncement
    ))
    .addStringOption(o => o.setName('heure').setDescription('Nouvelle heure HH:MM (optionnel)'))
    .addStringOption(o => o.setName('freq').setDescription('Nouvelle fréquence (optionnel)').addChoices(
      { name: 'quotidien', value: 'daily' },
      { name: 'jours ouvrés (lun–ven)', value: 'weekdays' },
      { name: 'week-end (sam, dim)', value: 'weekends' },
      { name: 'lundi', value: 'mon' }, { name: 'mardi', value: 'tue' }, { name: 'mercredi', value: 'wed' },
      { name: 'jeudi', value: 'thu' }, { name: 'vendredi', value: 'fri' }, { name: 'samedi', value: 'sat' }, { name: 'dimanche', value: 'sun' }
    ))
    .addStringOption(o => o.setName('message').setDescription('Nouveau message (optionnel)'))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // 🔐 Rôle seulement (on n’impose plus un channel unique : mirroring géré par officerReply utils)
  const rule = COMMAND_RULES['notif'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

  const sub = interaction.options.getSubcommand(true);
  const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';

  try {
    await officerDefer(interaction); // 🆕 au lieu de deferReply({ephemeral:true})
    let list = await loadNotifs();

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true) as Role;
      const chan = interaction.options.getChannel('channel', true) as TextChannel;
      const heure = interaction.options.getString('heure', true);
      const freq = interaction.options.getString('freq', true) as any;
      const msg  = interaction.options.getString('message') ?? '🔔 <@&ROLE> Rappel Castle Rush !';

      const spec = hhmmToSpec(heure, freq);
      if (!spec) return officerEdit(interaction, '❌ Heure invalide. Format attendu : `HH:MM` (24h).');

      const n: Notif = {
        id: newId(),
        roleId: role.id,
        channelId: chan.id,
        spec,
        tz,
        message: msg,
        createdBy: interaction.user.id
      };

      list.push(n);
      await saveNotifs(list);
      startNotifTask(interaction.client, n); // démarre le job immédiatement

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        msg: `[NOTIF] Added by ${interaction.user.tag}`,
        meta: { notifId: n.id, roleId: n.roleId, channelId: n.channelId, spec: n.spec, tz: n.tz }
      });

      const emb = makeEmbed({
        title: '✅ Notification ajoutée',
        fields: [
          { name: 'ID', value: `\`${n.id}\`` , inline: true },
          { name: 'Rôle', value: `<@&${n.roleId}>`, inline: true },
          { name: 'Salon', value: `<#${n.channelId}>`, inline: true },
          { name: 'CRON', value: `\`${n.spec}\` (${n.tz})` },
          { name: 'Message', value: n.message }
        ]
      });

      return officerEdit(interaction, { embeds: [emb] });
    }

    if (sub === 'list') {
      if (!list.length) return officerEdit(interaction, 'Aucune notification configurée.');
      const lines = list.map(n =>
        `• **${n.id}** — <@&${n.roleId}> → <#${n.channelId}> — \`${n.spec}\` (${n.tz})`
      ).join('\n');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'notif',
        msg: `[NOTIF] Listed by ${interaction.user.tag}`,
        meta: { count: list.length }
      });

      return officerEdit(interaction, { embeds: [makeEmbed({ title: '🔔 Notifications actives', description: lines })] });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      const idx = list.findIndex(n => n.id === id);
      if (idx === -1) return officerEdit(interaction, '❌ Notification introuvable.');
      stopNotifTask(id);
      const [removed] = list.splice(idx, 1);
      await saveNotifs(list);
      
      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'notif',
        msg: `[NOTIF] Removed by ${interaction.user.tag}`,
        meta: { notifId: removed.id }
      });

      return officerEdit(interaction, `🗑️ Notification **${removed.id}** supprimée.`);
    }

    if (sub === 'test') {
      const id = interaction.options.getString('id', true);
      const n = list.find(x => x.id === id);
      if (!n) return officerEdit(interaction, '❌ Notification introuvable.');

      // Confirme côté interaction
      await officerEdit(interaction, '▶️ Test envoyé.');

      // Envoi réel dans le salon cible (hors interaction)
      const content = n.message.replace(/<@&ROLE>/g, `<@&${n.roleId}>`);
      try {
        await sendToChannel(interaction.client, n.channelId, content);
      } catch (e) {
        console.error('[NOTIF TEST] fail', e);
      }
      return;
    }

    if (sub === 'edit') {
      const id = interaction.options.getString('id', true);
      const role = interaction.options.getRole('role') as Role | null;
      const chan = interaction.options.getChannel('channel') as TextChannel | null;
      const heure = interaction.options.getString('heure') || undefined;
      const freq  = interaction.options.getString('freq')  as any | undefined;
      const message = interaction.options.getString('message') || undefined;

      const n = list.find(x => x.id === id);
      if (!n) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'notif',
          msg: `[NOTIF] Edit failed - not found - by ${interaction.user.tag}`,
          meta: { notifId: id }
        });

        return officerEdit(interaction, '❌ Notification introuvable.');
      }

      if (role) n.roleId = role.id;
      if (chan) n.channelId = chan.id;

      if (heure || freq) {
        // Si on ne fournit qu'une partie, mieux vaut exiger les deux pour éviter les ambiguités.
        if (!heure || !freq) {
          return officerEdit(interaction, '❌ Pour modifier le timing, fournis **heure ET fréquence**.');
        }
        const newSpec = hhmmToSpec(heure, freq);
        if (!newSpec) return officerEdit(interaction, '❌ Heure/fréquence invalide(s).');
        n.spec = newSpec;
        n.tz = process.env.RESET_CRON_TZ || n.tz;
      }

      if (message) n.message = message;

      await saveNotifs(list);
      stopNotifTask(n.id);
      startNotifTask(interaction.client, n);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'notif',
        msg: `[NOTIF] Edited by ${interaction.user.tag}`,
        meta: { notifId: n.id, roleId: n.roleId, channelId: n.channelId, spec: n.spec, tz: n.tz }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '✏️ Notification modifiée',
          fields: [
            { name: 'ID', value: `\`${n.id}\``, inline: true },
            { name: 'Rôle', value: `<@&${n.roleId}>`, inline: true },
            { name: 'Salon', value: `<#${n.channelId}>`, inline: true },
            { name: 'CRON', value: `\`${n.spec}\` (${n.tz})` },
            { name: 'Message', value: n.message }
          ]
        })]
      });
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /notif.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'notif',
      msg: `[NOTIF] Error for ${interaction.user.tag}`,
      meta: { error: (e as Error).message }
    });
    return;
  }
}

export default { data, execute };
