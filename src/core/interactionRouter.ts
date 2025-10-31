/**
 * Routeur centralisé pour toutes les interactions Discord
 * 
 * Ce module centralise la gestion de toutes les interactions Discord reçues par le bot.
 * Il remplace l'ancien système où la logique de routing était dispersée dans index.ts.
 * 
 * Types d'interactions supportés :
 * - Slash Commands (ChatInputCommand)
 * - Autocomplete (pour les options avec suggestions dynamiques)
 * - Buttons (boutons dans les messages)
 * 
 * @module core/interactionRouter
 */

import type { Interaction } from 'discord.js';
import type { CommandModule } from '../types/index.js';
import { routeButton } from './buttonRouter.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('InteractionRouter');

/**
 * Route une interaction Discord vers le handler approprié
 * 
 * Point d'entrée unique pour toutes les interactions. Identifie le type d'interaction
 * et délègue au handler correspondant :
 * - Slash commands → `command.execute()`
 * - Autocomplete → `command.autocomplete()`
 * - Buttons → `routeButton()`
 * 
 * @param interaction L'interaction Discord reçue
 * @param commandMap Map des commandes chargées (depuis commandLoader)
 * 
 * @example
 * ```ts
 * client.on('interactionCreate', async (interaction) => {
 *   await routeInteraction(interaction, commands);
 * });
 * ```
 */
export async function routeInteraction(
  interaction: Interaction,
  commandMap: Map<string, CommandModule>
): Promise<void> {
  
  // Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) {
      log.warn({ commandName: interaction.commandName }, 'Commande inconnue');
      return;
    }
    await command.execute(interaction);
    return;
  }

  // Autocomplete
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (!command || !command.autocomplete) {
      // Pas d'autocomplete défini, retourner liste vide
      await interaction.respond([]).catch(() => {});
      return;
    }
    await command.autocomplete(interaction);
    return;
  }

  // Boutons
  if (interaction.isButton()) {
    await routeButton(interaction);
    return;
  }

  // Autres types d'interactions (non gérés pour l'instant)
  log.debug({ type: interaction.type }, 'Type d\'interaction non géré');
}
