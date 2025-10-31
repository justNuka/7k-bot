// src/commands/notifpanel.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType
} from 'discord.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { COMMAND_RULES, ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { buildPanelComponents, refreshPanelAll } from '../utils/notifPanel.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:notifpanel');
import { setPanelRef } from '../db/panel.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('notifpanel')
  .setDescription('Publie le panneau d’inscription aux rappels (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n);

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['notifpanel'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  try {
    await interaction.deferReply({ ephemeral: false });

    if (!CHANNEL_IDS.RAPPELS) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'notif',
        msg: '[NOTIFPANEL] Missing RAPPELS_CHANNEL_ID in config',
        meta: {}
      });
      
      return interaction.editReply('❌ RAPPELS_CHANNEL_ID manquant dans la configuration.');
    }
    const guild = interaction.guild!;
    const components = buildPanelComponents(guild);

    const e = makeEmbed({
      title: '🔔 Rappels — Abonnement',
      description: [
        'Clique sur les boutons pour **t’abonner / te désabonner** des rappels :',
        `• **CR** : <@&${ROLE_IDS.NOTIF_CR}>`,
        `• **Daily Guilde** : <@&${ROLE_IDS.NOTIF_DAILY}>`,
        `• **Début GvG** : <@&${ROLE_IDS.NOTIF_GVG}>`,
        '',
        'Tu peux changer d’avis à tout moment.',
      ].join('\n'),
      footer: 'Les rappels pingent seulement les rôles abonnés.',
    });

    const chan = await interaction.client.channels.fetch(CHANNEL_IDS.RAPPELS).catch(() => null);
    if (!chan || chan.type !== ChannelType.GuildText) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'notif',
        msg: '[NOTIFPANEL] Invalid rappels channel',
        meta: { channelId: CHANNEL_IDS.RAPPELS }
      });

      return interaction.editReply('❌ Salon rappels introuvable (doit être un salon texte).');
    }

    const msg = await chan.send({ embeds: [e], components });
    setPanelRef({ channel_id: chan.id, message_id: msg.id });

    await refreshPanelAll(interaction.client);

    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'notif',
      msg: '[NOTIFPANEL] Panel published',
      meta: { channelId: chan.id, messageId: msg.id, authorId: interaction.user.id }
    });

    await interaction.editReply('✅ Panneau publié dans le salon des rappels.');
  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /notifpanel');
    await safeError(interaction, 'Impossible de publier le panneau.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'notif',
      msg: '[NOTIFPANEL] Publish failed',
      meta: { error: e, authorId: interaction.user.id }
    });
    return;
  }
}
