// src/__tests__/mocks/discord.ts
// Mocks pour Discord.js (Interaction, Client, Guild, etc.)

import { vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';

/**
 * Crée un mock d'Interaction Discord
 * Note : on utilise 'as any' pour éviter les erreurs de typage strictes dans les tests
 */
export function createMockInteraction(options: {
  commandName: string;
  subcommand?: string;
  options?: Record<string, any>;
  userId?: string;
  guildId?: string;
  channelId?: string;
  roles?: string[];
  isDeferred?: boolean;
}): any {
  const {
    commandName,
    subcommand,
    options: cmdOptions = {},
    userId = '123456789',
    guildId = '987654321',
    channelId = '111222333',
    roles = [],
    isDeferred = false,
  } = options;

  // Mock roles cache (Map avec has())
  const rolesCache = new Map();
  roles.forEach(roleId => {
    rolesCache.set(roleId, { id: roleId, name: `Role-${roleId}` });
  });

  const interaction = {
    commandName,
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand ?? null),
      getString: vi.fn((name: string) => cmdOptions[name] ?? null),
      getBoolean: vi.fn((name: string) => cmdOptions[name] ?? null),
      getInteger: vi.fn((name: string) => cmdOptions[name] ?? null),
      getUser: vi.fn((name: string) => cmdOptions[name] ?? null),
      getRole: vi.fn((name: string) => cmdOptions[name] ?? null),
      getChannel: vi.fn((name: string) => cmdOptions[name] ?? null),
      getFocused: vi.fn().mockReturnValue(''),
    },
    user: {
      id: userId,
      tag: 'TestUser#0001',
      username: 'TestUser',
      bot: false,
    },
    member: {
      id: userId,
      roles: {
        cache: rolesCache,
      },
    },
    guild: {
      id: guildId,
      name: 'Test Guild',
      channels: {
        fetch: vi.fn().mockResolvedValue({ id: channelId, name: 'test-channel' }),
      },
      roles: {
        fetch: vi.fn().mockResolvedValue({ id: 'roleId', name: 'TestRole' }),
      },
      members: {
        fetch: vi.fn().mockResolvedValue({
          id: userId,
          roles: { cache: rolesCache },
        }),
      },
    },
    guildId,
    channelId,
    id: 'interaction-id',
    createdTimestamp: Date.now(),
    inGuild: vi.fn().mockReturnValue(true),
    isCommand: vi.fn().mockReturnValue(true),
    isChatInputCommand: vi.fn().mockReturnValue(true),
    
    // Méthodes de réponse (mockées)
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    
    // État
    deferred: isDeferred,
    replied: false,
    ephemeral: false,
  };

  return interaction;
}

/**
 * Ajoute un rôle au member d'une interaction mockée
 */
export function addRoleToMockMember(
  interaction: any,
  roleId: string,
  roleName: string = 'TestRole'
) {
  if (!interaction.member?.roles?.cache) return;
  
  interaction.member.roles.cache.set(roleId, {
    id: roleId,
    name: roleName,
  });
}

/**
 * Crée un mock de Client Discord (si besoin pour les jobs/tests intégration)
 */
export function createMockClient(): any {
  return {
    user: {
      id: 'bot-id',
      tag: 'TestBot#0000',
      username: 'TestBot',
    },
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        id: 'guild-id',
        name: 'Test Guild',
      }),
    },
    channels: {
      fetch: vi.fn().mockResolvedValue({
        id: 'channel-id',
        name: 'test-channel',
        send: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
}
