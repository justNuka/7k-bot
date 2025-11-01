import { getMeta, setMeta } from '../db/meta.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { CHANNEL_IDS } from '../config/permissions.js';
import { readChangelogSection } from '../utils/changelog.js';
import { pushLog } from '../http/logs.js';
export async function announceVersionIfNeeded(client) {
    const current = process.env.BOT_VERSION?.trim();
    if (!current)
        return;
    const last = getMeta('last_announced_version');
    if (last === current)
        return;
    const chanId = CHANNEL_IDS.RETOURS_BOT || CHANNEL_IDS.RAPPELS;
    if (!chanId)
        return;
    const chan = await client.channels.fetch(chanId).catch(() => null);
    if (!chan || !chan.isTextBased())
        return;
    const sec = await readChangelogSection(current);
    const emb = makeEmbed({
        title: `📦 Mise à jour du bot — v${current}`,
        description: sec ? sec.body : '_Voir CHANGELOG.md_',
        footer: sec ? sec.title : undefined,
        timestamp: new Date(),
    });
    await chan.send({ embeds: [emb] });
    setMeta('last_announced_version', current);
    pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'changelog',
        msg: `Announced version ${current}`,
        meta: { version: current, channelId: chanId }
    });
}
