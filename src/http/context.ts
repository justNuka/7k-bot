// src/http/context.ts
import type { Client } from 'discord.js';

export let discordClient: Client | null = null;

export function bindDiscordClient(c: Client) {
  discordClient = c;
}
