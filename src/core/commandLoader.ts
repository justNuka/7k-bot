/**
 * Chargeur automatique de commandes
 * Scan le dossier src/commands/ et construit une Map de commandes
 */

import type { CommandModule } from '../types/index.js';

/**
 * Charge toutes les commandes depuis src/commands/
 * @returns Map<commandName, commandModule>
 */
export async function loadCommands(): Promise<Map<string, CommandModule>> {
  const commandMap = new Map<string, CommandModule>();

  // Import explicite de toutes les commandes
  // (import dynamique avec glob non supporté en ESM standard, on reste explicite)
  const commands = {
    'help': await import('../commands/help.js'),
    'helpadmin': await import('../commands/helpadmin.js'),
    'gdoc': await import('../commands/gdoc.js'),
    'infoserveur': await import('../commands/infoserveur.js'),
    'oubli-cr': await import('../commands/oubli-cr.js'),
    'low-score': await import('../commands/low-score.js'),
    'notif': await import('../commands/notif.js'),
    'notifpanel': await import('../commands/notifpanel.js'),
    'banniere': await import('../commands/banniere.js'),
    'roleset': await import('../commands/roleset.js'),
    'scrape': await import('../commands/scrape.js'),
    'candidatures': await import('../commands/candidatures.js'),
    'absence': await import('../commands/absence.js'),
    'kick': await import('../commands/kick.js'),
    'yt': await import('../commands/yt.js'),
    'ytroute': await import('../commands/ytroute.js'),
    'signalement': await import('../commands/signalement.js'),
    'diag': await import('../commands/diag.js'),
    'coaching': await import('../commands/coaching.js'),
    'changelog': await import('../commands/changelog.js'),
    'pingoff': await import('../commands/pingoff.js'),
  };

  // Construire la Map
  for (const [name, mod] of Object.entries(commands)) {
    commandMap.set(name, mod as CommandModule);
  }

  return commandMap;
}
