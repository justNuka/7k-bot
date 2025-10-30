import type { ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { CHANNEL_IDS, COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { officerDeferPublic, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('diag')
  .setDescription('Diagnostics (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('threads')
    .setDescription('Vérifie la capacité à créer des threads privés dans RETOURS_BOT')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['roleset'] ?? COMMAND_RULES['notif'] ?? { roles: [], channels: [] };
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

  const sub = interaction.options.getSubcommand(true);

  try {
    await officerDeferPublic(interaction);

    if (sub === 'threads') {
      const channelId = CHANNEL_IDS.RETOURS_BOT ?? interaction.channelId;
      const base = await interaction.client.channels.fetch(channelId).catch(() => null);

      if (!base || base.type !== ChannelType.GuildText) {
        await officerEdit(interaction, '❌ Salon RETOURS_BOT introuvable ou non textuel.');
        return;
      }

      const chan = base as TextChannel;
      const me: GuildMember | null = chan.guild.members.me ?? null;
      if (!me) {
        await officerEdit(interaction, '❌ Impossible de récupérer les permissions du bot sur le serveur.');
        return;
      }

      // Vérification théorique des permissions
      const perms = chan.permissionsFor(me);
      const checks = {
        ViewChannel: perms?.has(PermissionFlagsBits.ViewChannel) ?? false,
        SendMessages: perms?.has(PermissionFlagsBits.SendMessages) ?? false,
        CreatePrivateThreads: perms?.has(PermissionFlagsBits.CreatePrivateThreads) ?? false,
        SendMessagesInThreads: perms?.has(PermissionFlagsBits.SendMessagesInThreads) ?? false,
        ManageThreads: perms?.has(PermissionFlagsBits.ManageThreads) ?? false, // utile pour ajouter des membres/close
        MentionEveryone: perms?.has(PermissionFlagsBits.MentionEveryone) ?? false, // optionnel, pour mentions role/users controlées
      };

      // Test pratique : créer un thread privé, y poster un message, puis le supprimer
      let practical = {
        created: false,
        posted: false,
        cleaned: false,
        error: '' as string | undefined,
        threadId: '' as string | undefined,
      };

      try {
        const thread = await chan.threads.create({
          name: `diag-threads-${Date.now()}`.slice(0, 90),
          autoArchiveDuration: 60,
          type: ChannelType.PrivateThread,
          reason: 'Diag threads (test de création de fil privé)',
        });

        practical.created = true;
        practical.threadId = thread.id;

        await thread.send({ content: '✅ Test: envoi dans fil privé OK.' });
        practical.posted = true;

        // Nettoyage
        await thread.delete('Diag threads: nettoyage');
        practical.cleaned = true;
      } catch (e: any) {
        practical.error = e?.message ?? String(e);
      }

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'diag',
        msg: `[DIAG] threads run by ${interaction.user.tag}`,
        meta: { channelId, checks, practical }
      });

      const fmt = (ok: boolean) => ok ? '✅' : '❌';

      const embed = makeEmbed({
        title: '🧪 Diagnostic threads (RETOURS_BOT)',
        fields: [
          {
            name: 'Salon',
            value: `<#${chan.id}>`,
            inline: false,
          },
          {
            name: 'Permissions (théorique)',
            value: [
              `${fmt(checks.ViewChannel)} ViewChannel`,
              `${fmt(checks.SendMessages)} SendMessages`,
              `${fmt(checks.CreatePrivateThreads)} CreatePrivateThreads`,
              `${fmt(checks.SendMessagesInThreads)} SendMessagesInThreads`,
              `${fmt(checks.ManageThreads)} ManageThreads`,
              `${fmt(checks.MentionEveryone)} MentionEveryone (optionnel)`,
            ].join('\n'),
            inline: false,
          },
          {
            name: 'Test pratique',
            value: [
              `${fmt(practical.created)} Création fil privé`,
              `${fmt(practical.posted)} Envoi d’un message`,
              `${fmt(practical.cleaned)} Nettoyage (suppression)`,
              practical.threadId ? `ID: \`${practical.threadId}\`` : '',
              practical.error ? `Erreur: \`${practical.error}\`` : '',
            ].filter(Boolean).join('\n'),
            inline: false,
          }
        ],
        footer: 'Astuce: si la création échoue, vérifie les permissions du bot sur ce salon.',
        timestamp: new Date(),
      });

      await officerEdit(interaction, { embeds: [embed] });
      return;
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /diag threads.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'diag',
      msg: `[DIAG] error on /diag threads by ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, error: (e as Error).message }
    });
  }
}

export default { data, execute };
