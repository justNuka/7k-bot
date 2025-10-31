/**
 * Types centralisés pour le bot Discord 7K Rebirth
 * 
 * Ce fichier contient les interfaces partagées utilisées dans tout le projet.
 * Tous les modules de commande, handlers et services doivent respecter ces contrats.
 * 
 * @module types
 */

import type { 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  ButtonInteraction,
  SlashCommandBuilder 
} from 'discord.js';

/**
 * Module de commande slash standard
 * 
 * Chaque fichier dans `src/commands/` doit exporter un objet respectant cette interface.
 * Le système de chargement dynamique (`commandLoader`) détecte et charge automatiquement
 * tous les modules conformes.
 * 
 * @example
 * ```ts
 * export default {
 *   data: new SlashCommandBuilder()
 *     .setName('hello')
 *     .setDescription('Dit bonjour'),
 *   
 *   async execute(interaction) {
 *     await interaction.reply('Bonjour !');
 *   },
 *   
 *   // Optionnel : pour les suggestions dynamiques
 *   async autocomplete(interaction) {
 *     const focused = interaction.options.getFocused();
 *     const choices = ['option1', 'option2'].filter(c => c.startsWith(focused));
 *     await interaction.respond(choices.map(c => ({ name: c, value: c })));
 *   }
 * } satisfies CommandModule;
 * ```
 */
export interface CommandModule {
  /** Configuration de la commande slash (nom, description, options) */
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  
  /** Logique d'exécution de la commande */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  
  /** Handler optionnel pour l'autocomplete des options */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Handler de bouton avec préfixe
 * 
 * Utilisé par `buttonRouter` pour dispatcher les interactions de boutons.
 * Le préfixe permet d'identifier rapidement le type de bouton (ex: `notif:`, `cand:`).
 * 
 * @example
 * ```ts
 * const handler: ButtonHandler = {
 *   prefix: 'mybutton:',
 *   async handle(interaction) {
 *     const action = interaction.customId.split(':')[1];
 *     await interaction.reply(`Action: ${action}`);
 *   }
 * };
 * ```
 */
export interface ButtonHandler {
  /** Préfixe du customId du bouton (ex: 'notif:', 'cand:') */
  prefix: string;
  
  /** Fonction de gestion de l'interaction */
  handle: (interaction: ButtonInteraction) => Promise<void>;
}

/**
 * Configuration du bot chargée depuis l'environnement
 * 
 * Variables d'environnement requises pour le démarrage du bot.
 * Chargées via `dotenv` au lancement dans `src/index.ts`.
 * 
 * @example
 * ```env
 * DISCORD_TOKEN=your_bot_token
 * GUILD_ID=123456789
 * DASH_PORT=8787
 * DASH_API_KEY=secret_key_shared_with_dashboard
 * ```
 */
export interface BotConfig {
  /** Token du bot Discord (DISCORD_TOKEN) */
  token: string;
  
  /** ID du serveur Discord principal (GUILD_ID) */
  guildId: string;
  
  /** Port du serveur HTTP Fastify pour le dashboard (DASH_PORT, défaut: 8787) */
  dashPort?: number;
  
  /** Clé API partagée avec le dashboard (DASH_API_KEY) */
  dashApiKey?: string;
}
