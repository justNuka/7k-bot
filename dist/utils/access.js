import { PermissionFlagsBits } from 'discord.js';
export function isInAllowedChannel(i, allowed) {
    if (!i.inGuild() || allowed.length === 0)
        return true;
    return allowed.includes(i.channelId);
}
export async function hasOneOfRoles(i, roles) {
    if (!i.inGuild() || roles.length === 0)
        return true;
    const m = await i.guild.members.fetch(i.user.id).catch(() => null);
    if (!m)
        return false;
    return roles.some(rid => m.roles.cache.has(rid));
}
export async function requireAccess(i, { roles = [], channels = [], reason = 'Accès refusé.' }) {
    if (!isInAllowedChannel(i, channels)) {
        await i.reply({ content: '❌ Cette commande ne peut être utilisée que dans le salon autorisé.', ephemeral: true });
        return false;
    }
    if (!(await hasOneOfRoles(i, roles))) {
        await i.reply({ content: '❌ Cette commande est réservée aux **officiers**.', ephemeral: true });
        return false;
    }
    return true;
}
export function botCanManageRole(i, roleId) {
    if (!roleId)
        return false;
    const me = i.guild?.members.me;
    const role = i.guild?.roles.cache.get(roleId);
    if (!me || !role)
        return false;
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
        return false;
    return me.roles.highest.comparePositionTo(role) > 0;
}
