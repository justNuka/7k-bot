export function avatarUrlFrom(member) {
    const u = member.user;
    if (u.avatar) {
        return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
    }
    // avatar par défaut (0..5 via mod 5 — pour “nouveau” Discord on peut faire mod 6)
    const idx = Number(BigInt(u.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
export async function fetchMembersSafe(client, guildId, ids) {
    const g = await client.guilds.fetch(guildId);
    const out = {};
    await Promise.all(ids.map(async (id) => {
        try {
            const m = await g.members.fetch(id);
            out[id] = m ?? null;
        }
        catch {
            out[id] = null;
        }
    }));
    return out;
}
