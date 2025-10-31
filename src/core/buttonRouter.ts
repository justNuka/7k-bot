/**
 * Routeur centralisé pour les boutons Discord
 * Dispatch les interactions de boutons selon leur customId
 */

import type { ButtonInteraction } from 'discord.js';
import { handleNotifButton } from '../handlers/notifButtons.js';
import { handleCandidaturesButton } from '../commands/candidatures.js';
import { handleCrButtons } from '../handlers/crButtons.js';

/**
 * Map des handlers de boutons par préfixe de customId
 */
const buttonHandlers: Record<string, (interaction: ButtonInteraction) => Promise<any>> = {
  'notif:': handleNotifButton,
  'cand:': handleCandidaturesButton,
  'cr:': handleCrButtons,
};

/**
 * Route une interaction de bouton vers le handler approprié
 * @param interaction L'interaction de bouton Discord
 */
export async function routeButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  // Trouver le handler correspondant au préfixe
  for (const [prefix, handler] of Object.entries(buttonHandlers)) {
    if (customId.startsWith(prefix)) {
      await handler(interaction);
      return;
    }
  }

  // Aucun handler trouvé
  console.warn(`[ButtonRouter] Aucun handler pour le bouton: ${customId}`);
  if (interaction.isRepliable()) {
    await interaction.reply({
      content: '❌ Ce bouton n\'est plus supporté.',
      ephemeral: true,
    }).catch(() => {});
  }
}
