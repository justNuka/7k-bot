import type { ChatInputCommandInteraction, InteractionReplyOptions } from 'discord.js';

export async function safeError(interaction: ChatInputCommandInteraction, content: string | InteractionReplyOptions) {
  try {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(typeof content === 'string' ? { content } : content);
    }
    return interaction.reply(typeof content === 'string'
      ? { content, ephemeral: true }
      : { ...content, ephemeral: true });
  } catch (e) {
    console.error('safeError fail:', e);
  }
}
