// src/__tests__/commands/help.test.ts
// Tests pour la commande /help
import { describe, it, expect } from 'vitest';
import { execute } from '../../commands/help.js';
import { createMockInteraction, addRoleToMockMember } from '../mocks/discord.js';
import { ROLE_IDS } from '../../config/permissions.js';
describe('/help command', () => {
    it('devrait répondre avec un embed d\'aide (utilisateur normal, privé)', async () => {
        const interaction = createMockInteraction({
            commandName: 'help',
            options: { public: false },
        });
        await execute(interaction);
        // Vérifier que reply() a été appelé
        expect(interaction.reply).toHaveBeenCalledTimes(1);
        // Vérifier que le message est ephemeral (privé)
        const replyCall = interaction.reply.mock.calls[0][0];
        expect(replyCall.ephemeral).toBe(true);
        // Vérifier qu'un embed est présent
        expect(replyCall.embeds).toBeDefined();
        expect(replyCall.embeds.length).toBeGreaterThan(0);
        // Vérifier que le titre contient "Aide"
        const embed = replyCall.embeds[0];
        expect(embed.data.title).toMatch(/aide/i);
    });
    it('devrait afficher les commandes publiques pour tout le monde', async () => {
        const interaction = createMockInteraction({
            commandName: 'help',
            options: { public: false },
        });
        await execute(interaction);
        const replyCall = interaction.reply.mock.calls[0][0];
        const embed = replyCall.embeds[0];
        const description = embed.data.description || '';
        const fields = embed.data.fields || [];
        // Vérifier que les commandes publiques sont présentes
        const allText = description + fields.map((f) => f.name + f.value).join(' ');
        expect(allText).toMatch(/\/help/);
        expect(allText).toMatch(/\/gdoc/);
        expect(allText).toMatch(/\/infoserveur/);
    });
    it('devrait afficher les commandes officiers si l\'utilisateur a le rôle', async () => {
        const interaction = createMockInteraction({
            commandName: 'help',
            options: { public: false },
        });
        // Ajouter le rôle Officiers
        if (ROLE_IDS.OFFICIERS) {
            addRoleToMockMember(interaction, ROLE_IDS.OFFICIERS, 'Officiers');
        }
        await execute(interaction);
        const replyCall = interaction.reply.mock.calls[0][0];
        const embed = replyCall.embeds[0];
        const fields = embed.data.fields || [];
        const allText = fields.map((f) => f.name + f.value).join(' ');
        // Vérifier que les commandes officiers sont présentes
        expect(allText).toMatch(/oubli-cr|banniere|notif/i);
    });
    it('devrait être public si l\'option public est true', async () => {
        const interaction = createMockInteraction({
            commandName: 'help',
            options: { public: true },
        });
        await execute(interaction);
        const replyCall = interaction.reply.mock.calls[0][0];
        expect(replyCall.ephemeral).toBe(false);
    });
});
