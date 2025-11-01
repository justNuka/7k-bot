// Utils pour envoyer un message dans un channel (verif du type de channel)
import { ChannelType } from 'discord.js';
export async function sendToChannel(client, channelId, content) {
    const ch = await client.channels.fetch(channelId);
    if (!ch)
        return;
    switch (ch.type) {
        case ChannelType.GuildText:
            return ch.send(content);
        case ChannelType.GuildAnnouncement:
            return ch.send(content);
        case ChannelType.PublicThread:
        case ChannelType.PrivateThread:
            return ch.send(content);
        case ChannelType.DM:
            return ch.send(content);
        default:
            // Voice/Stage/etc. -> pas d’envoi possible
            return;
    }
}
