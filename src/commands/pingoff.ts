import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { pushLog } from '../http/logs.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cmd:pingoff');

export const data = new SlashCommandBuilder()
  .setName('pingoff')
  .setDescription('Alerter les officiers (remonter une info / signaler / autre)')
  .setDMPermission(false)
  .addStringOption(o => o
    .setName('motif')
    .setDescription('Raison')
    .setRequired(true)
    .addChoices(
      { name:'remonter_info',   value:'remonter_info' },
      { name:'signaler_membre', value:'signaler_membre' },
      { name:'autre',           value:'autre' },
    )
  )
  .addStringOption(o => o
    .setName('message')
    .setDescription('Détaille ta demande')
    .setRequired(true)
  )
  .addUserOption(o => o
    .setName('officier')
    .setDescription('Officier spécifique à prévenir (optionnel)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const motif = interaction.options.getString('motif', true);
  const message = interaction.options.getString('message', true);
  const officier = interaction.options.getUser('officier') || null;

  try {
    await interaction.deferReply({ ephemeral: true });

    const emb = makeEmbed({
      title: '🚨 Ping Officiers',
      description: message,
      fields: [
        { name: 'Motif', value: `\`${motif}\`` , inline: true },
        ...(officier ? [{ name: 'Officier ciblé', value: `${officier} (\`${officier.id}\`)`, inline: true }] : []),
        { name: 'Auteur', value: `${interaction.user} (\`${interaction.user.id}\`)` },
      ],
      timestamp: new Date(),
    });

    if (officier) {
      // DM à l’officier ciblé, aucun message en salon
      try {
          const dm = await officier.createDM();
          await dm.send({ embeds: [emb] });

          pushLog({
          ts: new Date().toISOString(),
          level: 'action',
          component: 'pingoff',
          msg: `[PINGOFF] DM to officer ${officier.tag} by ${interaction.user.tag}`,
          meta: { userId: interaction.user.id, officerId: officier.id, mode: 'direct' }
          });

          await interaction.editReply('✅ Ton message a été envoyé en privé à l’officier sélectionné.');
          return;
      } catch {
          // --- FALLBACK : thread privé dans RETOURS_BOT ---
          const retoursId = CHANNEL_IDS.RETOURS_BOT ?? interaction.channelId;
          const base = await interaction.client.channels.fetch(retoursId).catch(() => null);

          if (!base || base.type !== ChannelType.GuildText) {
          await interaction.editReply(
              '⚠️ Impossible d’envoyer un DM à cet officier **et** de créer un fil privé (salon retours introuvable).'
          );
          return;
          }

          try {
          const thread = await (base as TextChannel).threads.create({
              name: `pingoff-${officier.username}-${interaction.user.username}`.slice(0, 90),
              autoArchiveDuration: 1440, // 24h
              type: ChannelType.PrivateThread,
              reason: 'pingoff fallback: DM closed',
          });

          // Ajouter uniquement l’auteur + l’officier
          await thread.members.add(interaction.user.id).catch(() => null);
          await thread.members.add(officier.id).catch(() => null);

          // Poster le message en mentionnant UNIQUEMENT l’officier
          await thread.send({
              content: `<@${officier.id}>`,
              embeds: [emb],
              allowedMentions: { users: [officier.id], roles: [], parse: [] },
          });

          pushLog({
              ts: new Date().toISOString(),
              level: 'action',
              component: 'pingoff',
              msg: `[PINGOFF] Fallback private thread created`,
              meta: { userId: interaction.user.id, officerId: officier.id, threadId: thread.id, channelId: retoursId }
          });

          const guildId = interaction.guildId!;
          const jump = `https://discord.com/channels/${guildId}/${retoursId}/${thread.id}`;
          await interaction.editReply(`✅ DM impossible. J’ai créé un fil privé avec l’officier ici : <${jump}>`);
          } catch {
          await interaction.editReply(
              '⚠️ DM impossible et création de fil privé échouée (permissions ?). Réessaie plus tard.'
          );
          }
          return;
      }
    }

    pushLog({
      ts: new Date().toISOString(),
      level: 'action',
      component: 'pingoff',
      msg: `[PINGOFF] broadcast by ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, channelId: "Thread created and specified officer pinged", mode: 'broadcast' }
    });

    await interaction.editReply('✅ Ton message a été envoyé aux officiers.');
  } catch (e) {
    log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /pingoff');
    await safeError(interaction, 'Erreur sur /pingoff.');
  }
}

export default { data, execute };
