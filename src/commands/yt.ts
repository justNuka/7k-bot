// src/commands/yt.ts
import type { ChatInputCommandInteraction, AnyThreadChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { officerDeferPublic, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';
import { fetchYTFeed } from '../utils/youtube.js';
import {
  listSubs, getSubByChannel, insertSub, deleteSubByChannel, updateSubThread
} from '../db/yt.js';
import { runOnceForChannel } from '../jobs/ytWatch.js';

function newId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `yt_${stamp}_${rnd}`;
}

export const data = new SlashCommandBuilder()
  .setName('yt')
  .setDescription('Suivi des chaînes YouTube (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajouter une chaîne à suivre')
    .addStringOption(o => o.setName('channel_id').setDescription('ID de chaîne (UCxxxx)').setRequired(true))
    .addChannelOption(o => o
      .setName('thread')
      .setDescription('Thread où poster les vidéos')
      .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
      .setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprimer une chaîne')
    .addStringOption(o => o.setName('channel_id').setDescription('ID de chaîne (UCxxxx)').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister les chaînes suivies')
  )
  .addSubcommand(sc => sc
    .setName('setthread')
    .setDescription('Changer le thread cible pour une chaîne')
    .addStringOption(o => o.setName('channel_id').setDescription('ID de chaîne (UCxxxx)').setRequired(true))
    .addChannelOption(o => o
      .setName('thread')
      .setDescription('Nouveau thread')
      .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
      .setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('test')
    .setDescription('Tester une chaîne (poste la dernière vidéo)')
    .addStringOption(o => o.setName('channel_id').setDescription('ID de chaîne (UCxxxx)').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['youtube'] ?? COMMAND_RULES['notif'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDeferPublic(interaction);

    if (sub === 'add') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const thread = interaction.options.getChannel('thread', true) as AnyThreadChannel;

      if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
        pushLog({ ts: new Date().toISOString(), level: 'warn', component: 'yt',
          msg: `[YT] Invalid channel ID attempted: ${channelId}`, meta: { userId: interaction.user.id }});
        return officerEdit(interaction, '❌ `channel_id` invalide. Il doit ressembler à `UCxxxxx...`');
      }
      if (getSubByChannel(channelId)) {
        pushLog({ ts: new Date().toISOString(), level: 'warn', component: 'yt',
          msg: `[YT] Duplicate channel ID attempted: ${channelId}`, meta: { userId: interaction.user.id }});
        return officerEdit(interaction, 'ℹ️ Cette chaîne est déjà suivie.');
      }

      let title = '';
      let lastVideoId: string | undefined;
      try {
        const items = await fetchYTFeed(channelId);
        title = items[0]?.title ? `[YT] ${items[0].title}` : '';
        lastVideoId = items[0]?.videoId;
      } catch {}

      insertSub({
        id: newId(),
        channel_id: channelId,
        thread_id: thread.id,
        title: title || null,
        last_video: lastVideoId ?? null,
        added_by: interaction.user.id,
      });

      pushLog({ ts: new Date().toISOString(), level: 'info', component: 'yt',
        msg: `[YT] Channel added: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, threadId: thread.id, userId: interaction.user.id } });

      const e = makeEmbed({
        title: '✅ Chaîne ajoutée',
        fields: [
          { name: 'Channel ID', value: `\`${channelId}\``, inline: false },
          { name: 'Thread', value: `<#${thread.id}>`, inline: false },
          ...(title ? [{ name: 'Titre (sample)', value: title }] : [])
        ]
      });
      return officerEdit(interaction, { embeds: [e] });
    }

    if (sub === 'remove') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      if (!getSubByChannel(channelId)) return officerEdit(interaction, '❌ Chaîne introuvable.');
      deleteSubByChannel(channelId);

      pushLog({ ts: new Date().toISOString(), level: 'info', component: 'yt',
        msg: `[YT] Channel removed: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, userId: interaction.user.id } });

      return officerEdit(interaction, `🗑️ Suivi supprimé pour \`${channelId}\`.`);
    }

    if (sub === 'list') {
      const list = listSubs();
      if (!list.length) return officerEdit(interaction, 'Aucune chaîne suivie.');
      const lines = list.map(s => `• \`${s.channel_id}\` → <#${s.thread_id}>  ${s.last_video ? `(last: \`${s.last_video}\`)` : ''}`).join('\n');

      pushLog({ ts: new Date().toISOString(), level: 'info', component: 'yt',
        msg: `[YT] Channel list requested (by ${interaction.user.id})`, meta: { userId: interaction.user.id } });

      return officerEdit(interaction, { embeds: [makeEmbed({ title: '📜 Chaînes suivies', description: lines })] });
    }

    if (sub === 'setthread') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const thread = interaction.options.getChannel('thread', true) as AnyThreadChannel;
      if (!getSubByChannel(channelId)) return officerEdit(interaction, '❌ Chaîne introuvable.');

      updateSubThread(channelId, thread.id);

      pushLog({ ts: new Date().toISOString(), level: 'info', component: 'yt',
        msg: `[YT] Channel thread updated: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, threadId: thread.id, userId: interaction.user.id } });

      return officerEdit(interaction, `✏️ Thread mis à jour pour \`${channelId}\` → <#${thread.id}>.`);
    }

    if (sub === 'test') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const subRow = getSubByChannel(channelId);
      if (!subRow) return officerEdit(interaction, '❌ Chaîne introuvable.');

      try {
        const last = await runOnceForChannel(interaction.client, channelId);
        if (!last) return officerEdit(interaction, 'Aucune vidéo trouvée sur le flux.');

        const chan = await interaction.client.channels.fetch(subRow.thread_id).catch(() => null);
        if (!chan || !chan.isTextBased()) return officerEdit(interaction, 'Thread introuvable/non textuel.');
        // @ts-ignore
        await chan.send({ content: `▶️ **Test** — ${last.title}\n${last.link}` });

        pushLog({ ts: new Date().toISOString(), level: 'info', component: 'yt',
          msg: `[YT] Test video posted for channel: ${channelId} (by ${interaction.user.id})`,
          meta: { channelId, threadId: subRow.thread_id, userId: interaction.user.id } });

        return officerEdit(interaction, '✅ Test envoyé.');
      } catch (e) {
        console.error('[YT test] fail', e);
        pushLog({ ts: new Date().toISOString(), level: 'error', component: 'yt',
          msg: `[YT] Test failed for channel: ${channelId} (by ${interaction.user.id})`,
          meta: { channelId, userId: interaction.user.id, error: (e as Error).message } });
        return officerEdit(interaction, '❌ Échec du test.');
      }
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /yt.');
    pushLog({ ts: new Date().toISOString(), level: 'error', component: 'yt',
      msg: `[YT] /yt command error (by ${interaction.user.id})`,
      meta: { userId: interaction.user.id, error: (e as Error).message } });
  }
}

export default { data, execute };
