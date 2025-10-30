// src/commands/notif.ts
import type { ChatInputCommandInteraction, Role, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { hhmmToSpec } from '../utils/cron.js';
import {
  loadNotifs, startNotifTask, stopNotifTask, reloadAllNotifs,
  createNotif, editNotif, removeNotif, type Notif
} from '../jobs/notifs.js'; // ⬅️ MAJ imports (plus de saveNotifs ici)
import { sendToChannel } from '../utils/send.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js';
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
  const rule = COMMAND_RULES['notif'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

  const sub = interaction.options.getSubcommand(true);
  const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';

  try {
    await officerDefer(interaction);
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

      // ⬇️ DB + start cron
      createNotif(interaction.client, n);
      list = await loadNotifs();

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
      const found = list.find(n => n.id === id);
      if (!found) return officerEdit(interaction, '❌ Notification introuvable.');

      removeNotif(id); // ⬅️ stop + delete
      list = await loadNotifs();

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'notif',
        msg: `[NOTIF] Removed by ${interaction.user.tag}`,
        meta: { notifId: id }
      });

      return officerEdit(interaction, `🗑️ Notification **${id}** supprimée.`);
    }

    if (sub === 'test') {
      const id = interaction.options.getString('id', true);
      const n = list.find(x => x.id === id);
      if (!n) return officerEdit(interaction, '❌ Notification introuvable.');

      await officerEdit(interaction, '▶️ Test envoyé.');
      const content = n.message.replace(/<@&ROLE>/g, `<@&${n.roleId}>`);
      try { await sendToChannel(interaction.client, n.channelId, content); } catch {}
      return;
    }

    if (sub === 'edit') {
      const id = interaction.options.getString('id', true);
      const role = interaction.options.getRole('role') as Role | null;
      const chan = interaction.options.getChannel('channel') as TextChannel | null;
      const heure = interaction.options.getString('heure') || undefined;
      const freq  = interaction.options.getString('freq')  as any | undefined;
      const message = interaction.options.getString('message') || undefined;

      const cur = list.find(x => x.id === id);
      if (!cur) return officerEdit(interaction, '❌ Notification introuvable.');

      if (role) cur.roleId = role.id;
      if (chan) cur.channelId = chan.id;

      if (heure || freq) {
        if (!heure || !freq) return officerEdit(interaction, '❌ Pour modifier le timing, fournis **heure ET fréquence**.');
        const newSpec = hhmmToSpec(heure, freq);
        if (!newSpec) return officerEdit(interaction, '❌ Heure/fréquence invalide(s).');
        cur.spec = newSpec;
        cur.tz = process.env.RESET_CRON_TZ || cur.tz;
      }
      if (message) cur.message = message;

      editNotif(interaction.client, cur); // ⬅️ DB + restart cron
      list = await loadNotifs();

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'notif',
        msg: `[NOTIF] Edited by ${interaction.user.tag}`,
        meta: { notifId: cur.id, roleId: cur.roleId, channelId: cur.channelId, spec: cur.spec, tz: cur.tz }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '✏️ Notification modifiée',
          fields: [
            { name: 'ID', value: `\`${cur.id}\``, inline: true },
            { name: 'Rôle', value: `<@&${cur.roleId}>`, inline: true },
            { name: 'Salon', value: `<#${cur.channelId}>`, inline: true },
            { name: 'CRON', value: `\`${cur.spec}\` (${cur.tz})` },
            { name: 'Message', value: cur.message }
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
  }
}

export default { data, execute };
