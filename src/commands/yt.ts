import type { ChatInputCommandInteraction, AnyThreadChannel, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { loadYTSubs, saveYTSubs, newYTId, type YTSub, runOnce } from '../jobs/ytWatch.js';
import { fetchYTFeed } from '../utils/youtube.js';
import { officerDeferPublic, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';

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
  const rule = COMMAND_RULES['youtube'] ?? COMMAND_RULES['notif']; // autorisations officiers
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDeferPublic(interaction); // réponse publique + miroir auto

    let list = await loadYTSubs();

    if (sub === 'add') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const thread = interaction.options.getChannel('thread', true) as AnyThreadChannel;

      if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'yt',
          msg: `[YT] Invalid channel ID attempted: ${channelId}`,
          meta: { userId: interaction.user.id }
        });

        return officerEdit(interaction, '❌ `channel_id` invalide. Il doit ressembler à `UCxxxxx...`');
      }
      if (list.some(s => s.channelId === channelId)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'yt',
          msg: `[YT] Duplicate channel ID attempted: ${channelId}`,
          meta: { userId: interaction.user.id }
        });

        return officerEdit(interaction, 'ℹ️ Cette chaîne est déjà suivie.');
      }

      // ping le flux pour récupérer un titre / dernière vidéo
      let title = '';
      let lastVideoId: string | undefined;
      try {
        const items = await fetchYTFeed(channelId);
        title = items[0]?.title ? `[YT] ${items[0].title}` : '';
        lastVideoId = items[0]?.videoId; // on seed pour éviter un spam initial
      } catch {}

      const subObj: YTSub = {
        id: newYTId(),
        channelId,
        threadId: thread.id,
        title,
        lastVideoId,
        addedBy: interaction.user.id
      };
      list.push(subObj);
      await saveYTSubs(list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'yt',
        msg: `[YT] Channel added: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, threadId: thread.id, userId: interaction.user.id }
      });

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
      const idx = list.findIndex(s => s.channelId === channelId);
      if (idx === -1) return officerEdit(interaction, '❌ Chaîne introuvable.');
      const [rm] = list.splice(idx, 1);
      await saveYTSubs(list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'yt',
        msg: `[YT] Channel removed: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, threadId: rm.threadId, userId: interaction.user.id }
      });

      return officerEdit(interaction, `🗑️ Suivi supprimé pour \`${rm.channelId}\`.`);
    }

    if (sub === 'list') {
      if (!list.length) return officerEdit(interaction, 'Aucune chaîne suivie.');
      const lines = list.map(s => `• \`${s.channelId}\` → <#${s.threadId}>  ${s.lastVideoId ? `(last: \`${s.lastVideoId}\`)` : ''}`).join('\n');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'yt',
        msg: `[YT] Channel list requested (by ${interaction.user.id})`,
        meta: { userId: interaction.user.id }
      });

      return officerEdit(interaction, { embeds: [makeEmbed({ title: '📜 Chaînes suivies', description: lines })] });
    }

    if (sub === 'setthread') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const thread = interaction.options.getChannel('thread', true) as AnyThreadChannel;
      const s = list.find(x => x.channelId === channelId);
      if (!s) return officerEdit(interaction, '❌ Chaîne introuvable.');
      s.threadId = thread.id;
      await saveYTSubs(list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'yt',
        msg: `[YT] Channel thread updated: ${channelId} (by ${interaction.user.id})`,
        meta: { channelId, threadId: thread.id, userId: interaction.user.id }
      });

      return officerEdit(interaction, `✏️ Thread mis à jour pour \`${channelId}\` → <#${thread.id}>.`);
    }

    if (sub === 'test') {
      const channelId = interaction.options.getString('channel_id', true).trim();
      const s = list.find(x => x.channelId === channelId);
      if (!s) return officerEdit(interaction, '❌ Chaîne introuvable.');
      try {
        const items = await fetchYTFeed(channelId);
        if (!items.length) return officerEdit(interaction, 'Aucune vidéo trouvée sur le flux.');
        // poste la dernière vidéo connue (la plus récente)
        const last = items[0];
        const content = `▶️ **Test** — ${last.title}\n${last.link}`;
        const chan = await interaction.client.channels.fetch(s.threadId).catch(() => null);
        if (!chan || !chan.isTextBased()) return officerEdit(interaction, 'Thread introuvable/non textuel.');
        await (chan as any).send({ content });

        pushLog({
          ts: new Date().toISOString(),
          level: 'info',
          component: 'yt',
          msg: `[YT] Test video posted for channel: ${channelId} (by ${interaction.user.id})`,
          meta: { channelId, threadId: s.threadId, userId: interaction.user.id }
        });

        return officerEdit(interaction, '✅ Test envoyé.');
      } catch (e) {
        console.error('[YT test] fail', e);
        pushLog({
          ts: new Date().toISOString(),
          level: 'error',
          component: 'yt',
          msg: `[YT] Test failed for channel: ${channelId} (by ${interaction.user.id})`,
          meta: { channelId, userId: interaction.user.id, error: (e as Error).message }
        });

        return officerEdit(interaction, '❌ Échec du test.');
      }
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /yt.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'yt',
      msg: `[YT] /yt command error (by ${interaction.user.id})`,
      meta: { userId: interaction.user.id, error: (e as Error).message }
    });
    return;
  }
}

export default { data, execute };
