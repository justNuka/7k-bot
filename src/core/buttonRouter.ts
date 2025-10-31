/**
 * Routeur centralisé pour les boutons Discord
 * 
 * Ce module gère le dispatch des interactions de boutons vers leurs handlers respectifs.
 * Le routing se fait par préfixe du `customId` du bouton (ex: `notif:toggle:cr`).
 * 
 * Convention de nommage des boutons :
 * - `notif:` → Notifications (toggle notif roles)
 * - `cand:` → Candidatures (accepter/refuser)
 * - `cr:` → CR (compteurs, oublis)
 * 
 * Pour ajouter un nouveau type de bouton :
 * 1. Créer le handler dans `src/handlers/buttons/`
 * 2. Ajouter le préfixe et le handler dans `buttonHandlers`
 * 
 * @module core/buttonRouter
 */

import type { ButtonInteraction } from 'discord.js';
import { handleNotifButton } from '../handlers/buttons/notifButtons.js';
import { handleCandidaturesButton } from '../commands/candidatures.js';
import { handleCrButtons } from '../handlers/buttons/crButtons.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ButtonRouter');

/**
 * Map des handlers de boutons par préfixe de customId
 * 
 * Chaque entrée associe un préfixe à sa fonction de gestion.
 * Le premier préfixe correspondant est utilisé.
 */
const buttonHandlers: Record<string, (interaction: ButtonInteraction) => Promise<any>> = {
  'notif:': handleNotifButton,   // Boutons de toggle notification
  'cand:': handleCandidaturesButton,  // Boutons accepter/refuser candidature
  'cr:': handleCrButtons,         // Boutons CR (compteurs, oublis)
};

/**
 * Route une interaction de bouton vers le handler approprié
 * 
 * Parcourt la liste des préfixes enregistrés et délègue au premier handler correspondant.
 * Si aucun handler n'est trouvé, répond avec un message d'erreur.
 * 
 * @param interaction L'interaction de bouton Discord
 * 
 * @example
 * ```ts
 * // Bouton avec customId "notif:toggle:cr"
 * // → Routé vers handleNotifButton (préfixe "notif:")
 * 
 * // Bouton avec customId "cand:accept:C-042"
 * // → Routé vers handleCandidaturesButton (préfixe "cand:")
 * ```
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
  log.warn({ customId }, 'Aucun handler pour ce bouton');
  if (interaction.isRepliable()) {
    await interaction.reply({
      content: '❌ Ce bouton n\'est plus supporté.',
      ephemeral: true,
    }).catch(() => {});
  }
}
