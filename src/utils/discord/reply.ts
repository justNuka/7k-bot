import type { ChatInputCommandInteraction, InteractionReplyOptions, InteractionEditReplyOptions } from 'discord.js';

export async function safeError(interaction: ChatInputCommandInteraction, content: string | InteractionReplyOptions) {
  try {
    if (interaction.deferred || interaction.replied) {
      const payload = typeof content === 'string' ? { content } : content;
      // Cast pour éviter l'erreur de type Discord.js (flags ephemeral/suppress incompatibles)
      return interaction.editReply(payload as InteractionEditReplyOptions);
    }
    return interaction.reply(typeof content === 'string'
      ? { content, ephemeral: true }
      : { ...content, ephemeral: true });
  } catch (e) {
    console.error('safeError fail:', e);
  }
}
