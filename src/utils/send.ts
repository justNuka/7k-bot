// Utils pour envoyer un message dans un channel (verif du type de channel)

import type {
  Client,
  MessageCreateOptions,
  TextChannel,
  NewsChannel,
  DMChannel,
  AnyThreadChannel
} from 'discord.js';
import { ChannelType } from 'discord.js';

export async function sendToChannel(
  client: Client,
  channelId: string,
  content: string | MessageCreateOptions
) {
  const ch = await client.channels.fetch(channelId);
  if (!ch) return;

  switch (ch.type) {
    case ChannelType.GuildText:
      return (ch as TextChannel).send(content);

    case ChannelType.GuildAnnouncement:
      return (ch as NewsChannel).send(content);

    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
      return (ch as AnyThreadChannel).send(content);

    case ChannelType.DM:
      return (ch as DMChannel).send(content);

    default:
      // Voice/Stage/etc. -> pas d’envoi possible
      return;
  }
}
