// src/commands/ytroute.ts
import type { ChatInputCommandInteraction, AnyThreadChannel, ForumChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import {
  listRoutes, insertThreadRoute, insertForumRoute,
  deleteRoute, type YTRouteRow
} from '../db/ytRoutes.js';
import { officerDeferPublic, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('ytroute')
  .setDescription('Routage des vidéos YouTube par titre (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('add-thread')
    .setDescription('Ajoute une route vers un thread existant')
    .addStringOption(o => o.setName('pattern').setDescription('Regex (ex: "infinite|tower")').setRequired(true))
    .addChannelOption(o => o.setName('thread')
      .setDescription('Thread cible')
      .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
      .setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('add-forum')
    .setDescription('Ajoute une route vers un post (créé/rouvert) d’un forum')
    .addStringOption(o => o.setName('pattern').setDescription('Regex').setRequired(true))
    .addChannelOption(o => o.setName('forum')
      .setDescription('Forum cible')
      .addChannelTypes(ChannelType.GuildForum)
      .setRequired(true))
    .addStringOption(o => o.setName('post_title').setDescription('Titre du post').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprime une route')
    .addStringOption(o => o.setName('id').setDescription('ID de route').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Liste des routes')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['ytroute'] ?? COMMAND_RULES['youtube'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDeferPublic(interaction);

    if (sub === 'add-thread') {
      const pattern = interaction.options.getString('pattern', true);
      const th = interaction.options.getChannel('thread', true) as AnyThreadChannel;

      // validation regex
      new RegExp(pattern, 'i');

      const id = insertThreadRoute(pattern, th.id);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'ytroute',
        msg: `[YTRoute] Added route /${pattern}/i → thread ${th.id} by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, routePattern: pattern, threadId: th.id, id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '✅ Route ajoutée (thread)',
          fields: [
            { name: 'ID', value: id, inline: true },
            { name: 'Pattern', value: `\`/${pattern}/i\``, inline: true },
            { name: 'Thread', value: `<#${th.id}>`, inline: false },
          ]
        })]
      });
    }

    if (sub === 'add-forum') {
      const pattern = interaction.options.getString('pattern', true);
      const forum = interaction.options.getChannel('forum', true) as ForumChannel;
      const postTitle = interaction.options.getString('post_title', true);

      new RegExp(pattern, 'i');

      const id = insertForumRoute(pattern, forum.id, postTitle);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'ytroute',
        msg: `[YTRoute] Added route /${pattern}/i → forum ${forum.id} (post "${postTitle}") by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, routePattern: pattern, forumId: forum.id, postTitle, id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({
          title: '✅ Route ajoutée (forum)',
          fields: [
            { name: 'ID', value: id, inline: true },
            { name: 'Pattern', value: `\`/${pattern}/i\``, inline: true },
            { name: 'Forum', value: `<#${forum.id}>`, inline: true },
            { name: 'Post', value: postTitle, inline: true },
          ]
        })]
      });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      const ok = deleteRoute(id);
      if (!ok) return officerEdit(interaction, '❌ ID introuvable.');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'ytroute',
        msg: `[YTRoute] Removed route ${id} by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, routeId: id }
      });

      return officerEdit(interaction, `🗑️ Route supprimée (\`${id}\`).`);
    }

    if (sub === 'list') {
      const routes = listRoutes();
      if (!routes.length) return officerEdit(interaction, 'Aucune route.');

      const lines = routes.map(r => {
        const dest = r.thread_id
          ? `thread <#${r.thread_id}>`
          : r.forum_id
            ? `forum <#${r.forum_id}> → post "${r.post_title}"`
            : '(invalide)';
        return `• \`${r.id}\` — /${r.pattern}/i → ${dest}`;
      }).join('\n');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'ytroute',
        msg: `[YTRoute] Listed routes by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, routeCount: routes.length }
      });

      return officerEdit(interaction, { embeds: [makeEmbed({ title: '📜 Routes YT', description: lines })] });
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /ytroute.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'ytroute',
      msg: `[YTRoute] Error on /ytroute by ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, error: (e as Error).message }
    });
  }
}

export default { data, execute };
