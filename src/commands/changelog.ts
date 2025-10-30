import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { requireAccess } from '../utils/access.js';
import { COMMAND_RULES, CHANNEL_IDS } from '../config/permissions.js';
import { readChangelogSection } from '../utils/changelog.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('changelog')
  .setDescription('Afficher ou publier le changelog courant')
  .setDMPermission(false)
  .addSubcommand(sc => sc
    .setName('show')
    .setDescription('Afficher le changelog v courante (privé)')
  )
  .addSubcommand(sc => sc
    .setName('post')
    .setDescription('Publier dans le salon changelog (officiers)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const version = process.env.BOT_VERSION?.trim();

  if (!version) {
    await interaction.reply({ content: '⚠️ BOT_VERSION non définie.', ephemeral: true });
    return;
  }

  try {
    if (sub === 'show') {
      await interaction.deferReply({ ephemeral: true });
      const sec = await readChangelogSection(version);
      const emb = makeEmbed({
        title: `📦 v${version} — Changelog`,
        description: sec ? sec.body : '_Aucun détail trouvé dans CHANGELOG.md_',
        footer: sec?.title,
      });
      await interaction.editReply({ embeds: [emb] });
      return;
    }

    if (sub === 'post') {
      // garde officiers (réutilise une rule existante ; ex 'roleset' ou 'notif')
      const rule = COMMAND_RULES['roleset'] ?? COMMAND_RULES['notif'];
      if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

      await interaction.deferReply({ ephemeral: true });

      const channelId = CHANNEL_IDS.RETOURS_BOT || CHANNEL_IDS.RAPPELS || interaction.channelId;
      const chan = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (!chan || chan.type !== ChannelType.GuildText) {
        await interaction.editReply('❌ Salon changelog introuvable.');
        return;
      }
      const sec = await readChangelogSection(version);
      const emb = makeEmbed({
        title: `📦 Mise à jour du bot — v${version}`,
        description: sec ? sec.body : '_Voir CHANGELOG.md_',
        footer: sec?.title,
        timestamp: new Date(),
      });
      await (chan as TextChannel).send({ embeds: [emb] });

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'changelog',
        msg: `/changelog post by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, version, channelId }
      });

      await interaction.editReply('✅ Changelog publié.');
      return;
    }
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /changelog.');
  }
}

export default { data, execute };
