import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('coaching')
  .setDescription('Demander un coaching ou une aide (visible des officiers)')
  .setDMPermission(false)
  .addStringOption(o => o
    .setName('type')
    .setDescription('Type de demande')
    .setRequired(true)
    .addChoices(
      { name:'coaching', value:'coaching' },
      { name:'aide',     value:'aide' }
    )
  )
  .addStringOption(o => o
    .setName('message')
    .setDescription('Explique brièvement ta demande')
    .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const kind = interaction.options.getString('type', true);
  const body = interaction.options.getString('message', true);

  try {
    await interaction.deferReply({ ephemeral: true });

    const retoursId = CHANNEL_IDS.RETOURS_BOT ?? interaction.channelId;
    const target = await interaction.client.channels.fetch(retoursId).catch(() => null);
    if (!target || target.type !== ChannelType.GuildText) {
      await interaction.editReply('❌ Salon retours bot introuvable.');
      return;
    }

    const ping = ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}>` : '';
    const emb = makeEmbed({
      title: kind === 'coaching' ? '📚 Demande de **Coaching**' : '🆘 Demande **Aide**',
      description: body,
      fields: [{ name: 'Auteur', value: `${interaction.user} (\`${interaction.user.id}\`)` }],
      timestamp: new Date(),
    });

    await (target as TextChannel).send({
      content: ping || undefined, // enlève cette ligne si tu ne veux pas ping le rôle
      embeds: [emb],
      allowedMentions: { parse: ['roles'] },
    });

    pushLog({
      ts: new Date().toISOString(),
      level: 'action',
      component: 'coaching',
      msg: `[COACHING] ${kind} from ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, kind, channelId: retoursId }
    });

    await interaction.editReply('✅ Ta demande a été transmise aux officiers. Merci !');
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur lors de l’envoi de ta demande.');
  }
}

export default { data, execute };
