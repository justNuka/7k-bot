/**
 * Types centralisés pour le bot Discord
 */

import type { 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  ButtonInteraction,
  SlashCommandBuilder 
} from 'discord.js';

/**
 * Module de commande slash standard
 */
export interface CommandModule {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Handler de bouton avec préfixe
 */
export interface ButtonHandler {
  prefix: string;
  handle: (interaction: ButtonInteraction) => Promise<void>;
}

/**
 * Configuration du bot
 */
export interface BotConfig {
  token: string;
  guildId: string;
  dashPort?: number;
  dashApiKey?: string;
}
