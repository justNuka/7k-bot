// src/utils/notifPanel.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { ROLE_IDS } from '../config/permissions.js';
import { makeEmbed } from './formatting/embed.js';
// ⬇️ NEW: on persiste en base via le module DB
import { getPanelRef, savePanelRef as dbSavePanelRef } from '../db/panel.js';
/** Signature inchangée pour la commande /notifpanel */
export async function savePanelRef(ref) {
    dbSavePanelRef(ref); // upsert en SQLite
}
function countRole(guild, roleId) {
    if (!roleId)
        return 0;
    const role = guild.roles.cache.get(roleId);
    return role?.members.size ?? 0;
}
/** Boutons d’abonnement + compteurs (comme avant) */
export function buildPanelComponents(guild) {
    const crCount = countRole(guild, ROLE_IDS.NOTIF_CR);
    const dailyCount = countRole(guild, ROLE_IDS.NOTIF_DAILY);
    const gvgCount = countRole(guild, ROLE_IDS.NOTIF_GVG);
    return [
        new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId('notif:toggle:cr')
            .setLabel(`Rappel CR (${crCount})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔'), new ButtonBuilder()
            .setCustomId('notif:toggle:daily')
            .setLabel(`Rappel Daily (${dailyCount})`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🧱'), new ButtonBuilder()
            .setCustomId('notif:toggle:gvg')
            .setLabel(`Rappel GvG (${gvgCount})`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚔️'))
    ];
}
/** Met à jour les **boutons (compteurs)** du message déjà publié */
export async function refreshPanelMessage(client) {
    const ref = getPanelRef();
    if (!ref)
        return;
    const chan = await client.channels.fetch(ref.channel_id).catch(() => null);
    if (!chan || chan.type !== ChannelType.GuildText)
        return;
    const guild = chan.guild;
    const components = buildPanelComponents(guild);
    const msg = await chan.messages.fetch(ref.message_id).catch(() => null);
    if (msg)
        await msg.edit({ components });
}
/** Met à jour **l’embed (texte)** avec les nombres d’inscrits */
export async function updateNotifPanel(client) {
    const ref = getPanelRef();
    if (!ref)
        return;
    const chan = await client.channels.fetch(ref.channel_id).catch(() => null);
    if (!chan || chan.type !== ChannelType.GuildText)
        return;
    const guild = chan.guild;
    const [nCR, nDay, nGvG] = [
        ROLE_IDS.NOTIF_CR,
        ROLE_IDS.NOTIF_DAILY,
        ROLE_IDS.NOTIF_GVG
    ].map(rid => guild.roles.cache.get(rid)?.members.size ?? 0);
    const msg = await chan.messages.fetch(ref.message_id).catch(() => null);
    if (!msg)
        return;
    const emb = makeEmbed({
        title: '🔔 Rappels disponibles',
        description: [
            `• Rappel **CR** : ${nCR} inscrit(s)`,
            `• Rappel **Dailies** : ${nDay} inscrit(s)`,
            `• Rappel **Début GvG** : ${nGvG} inscrit(s)`,
            '',
            `Clique sur les boutons ci-dessous pour t’inscrire / te désinscrire.`,
        ].join('\n')
    });
    await msg.edit({ embeds: [emb] });
}
/** Helper pratique pour tout rafraîchir après un toggle */
export async function refreshPanelAll(client) {
    await Promise.allSettled([
        refreshPanelMessage(client),
        updateNotifPanel(client),
    ]);
}
