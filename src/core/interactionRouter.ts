/**
 * Routeur centralisé pour toutes les interactions Discord
 * Dispatch vers commandes slash, autocomplete, ou boutons
 */

import type { Interaction } from 'discord.js';
import type { CommandModule } from '../types/index.js';
import { routeButton } from './buttonRouter.js';

/**
 * Route une interaction Discord vers le handler approprié
 * @param interaction L'interaction Discord (slash command, autocomplete, button, etc.)
 * @param commandMap Map des commandes chargées
 */
export async function routeInteraction(
  interaction: Interaction,
  commandMap: Map<string, CommandModule>
): Promise<void> {
  
  // Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) {
      console.error(`[InteractionRouter] Commande inconnue: ${interaction.commandName}`);
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
  console.log(`[InteractionRouter] Type d'interaction non géré: ${interaction.type}`);
}
