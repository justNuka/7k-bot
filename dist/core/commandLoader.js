/**
 * Chargeur automatique de commandes
 *
 * Ce module gère le chargement dynamique de tous les modules de commande depuis `src/commands/`.
 * Il remplace l'ancien système d'imports manuels (42 imports explicites dans index.ts).
 *
 * Chaque commande doit exporter un objet conforme à l'interface `CommandModule`.
 * Le loader construit une Map utilisée par le routeur d'interactions.
 *
 * @module core/commandLoader
 */
/**
 * Charge toutes les commandes depuis src/commands/
 *
 * Importe dynamiquement tous les modules de commande et construit une Map
 * associant le nom de la commande (depuis `data.name`) au module complet.
 *
 * Note: Les imports sont explicites car l'import dynamique avec glob pattern
 * n'est pas supporté nativement en ESM. Pour ajouter une commande, il suffit
 * de créer le fichier dans `src/commands/` et l'ajouter à la liste ci-dessous.
 *
 * @returns Map associant nom de commande → module de commande
 *
 * @example
 * ```ts
 * const commands = await loadCommands();
 * const helpCommand = commands.get('help');
 * if (helpCommand) {
 *   await helpCommand.execute(interaction);
 * }
 * ```
 */
export async function loadCommands() {
    const commandMap = new Map();
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
        'annoncespanel': await import('../commands/annoncespanel.js'),
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
        commandMap.set(name, mod);
    }
    return commandMap;
}
