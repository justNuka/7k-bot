// src/commands/annoncespanel.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType
} from 'discord.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { COMMAND_RULES, ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { createLogger } from '../utils/logger.js';
import { pushLog } from '../http/logs.js';

const log = createLogger('cmd:annoncespanel');

export const data = new SlashCommandBuilder()
  .setName('annoncespanel')
  .setDescription('Publie le panneau d\'inscription aux annonces Netmarble (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n);

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['notifpanel']; // Même règle que notifpanel (officiers)
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  try {
    await interaction.deferReply({ ephemeral: false });

    if (!CHANNEL_IDS.INFOS_SERVEUR) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'scraping',
        msg: '[ANNONCESPANEL] Missing INFOS_SERVEUR_CHANNEL_ID in config',
        meta: {}
      });
      
      return interaction.editReply('❌ INFOS_SERVEUR_CHANNEL_ID manquant dans la configuration.');
    }

    const guild = interaction.guild!;
    const role = guild.roles.cache.get(ROLE_IDS.NOTIF_ANNONCES_JEU);
    const count = role?.members.size ?? 0;

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('notif:toggle:annonces')
          .setLabel(`Annonces Netmarble (${count})`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📰')
      )
    ];

    const e = makeEmbed({
      title: '📰 Annonces Netmarble — Abonnement',
      description: [
        'Reçois une notification quand Netmarble publie :',
        '• 💬 **Developer Notes** (notes des développeurs)',
        '• 🔄 **Updates** (mises à jour du jeu)',
        '',
        `Actuellement, **${count} membre(s)** abonné(s).`,
        '',
        'Clique sur le bouton ci-dessous pour **t\'abonner / te désabonner** :',
      ].join('\n'),
      footer: 'Les Known Issues et Notices ne déclenchent pas de notification pour le moment.',
    });

    const chan = await interaction.client.channels.fetch(CHANNEL_IDS.INFOS_SERVEUR).catch(() => null);
    if (!chan || chan.type !== ChannelType.GuildText) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'scraping',
        msg: '[ANNONCESPANEL] Invalid infos-serveur channel',
        meta: { channelId: CHANNEL_IDS.INFOS_SERVEUR }
      });

      return interaction.editReply('❌ Salon infos-serveur introuvable (doit être un salon texte).');
    }

    const msg = await chan.send({ embeds: [e], components });

    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'scraping',
      msg: '[ANNONCESPANEL] Panel published',
      meta: { channelId: chan.id, messageId: msg.id, authorId: interaction.user.id }
    });

    await interaction.editReply(`✅ Panneau publié dans <#${chan.id}>.`);
  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /annoncespanel');
    await safeError(interaction, 'Impossible de publier le panneau.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'scraping',
      msg: '[ANNONCESPANEL] Publish failed',
      meta: { error: e, authorId: interaction.user.id }
    });
    return;
  }
}
