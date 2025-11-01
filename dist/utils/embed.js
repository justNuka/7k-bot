import { EmbedBuilder } from 'discord.js';
export const EMBED_COLOR = 0x5865F2; // Discord blurple
export function makeEmbed({ title, description, fields, footer, thumbnail, url, timestamp }) {
    const e = new EmbedBuilder().setColor(EMBED_COLOR);
    if (title)
        e.setTitle(title);
    if (description)
        e.setDescription(description);
    if (url)
        e.setURL(url);
    if (thumbnail)
        e.setThumbnail(thumbnail);
    if (fields?.length)
        e.addFields(fields);
    e.setFooter({ text: footer ?? '7K Rebirth Bot' });
    if (timestamp) {
        // Accept string/number/Date; convert string to Date for safety
        const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        e.setTimestamp(ts);
    }
    return e;
}
export function heroEmbed(h) {
    const fields = [];
    if (h.skills?.length)
        fields.push({ name: 'Skills', value: h.skills.join(' • ') });
    if (h.build)
        fields.push({ name: 'Build', value: h.build });
    if (h.notes)
        fields.push({ name: 'Notes', value: h.notes });
    const title = h.name +
        (h.role ? ` — ${h.role}` : '') +
        (h.element ? ` (${h.element})` : '');
    const e = makeEmbed({
        title,
        description: '',
        fields,
        thumbnail: h.image
    });
    return e;
}
