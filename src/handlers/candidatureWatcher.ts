// src/handlers/candidatureWatcher.ts
import { Colors, EmbedBuilder, Message } from 'discord.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { sendToChannel } from '../utils/send.js';
import { insertCandidature, hasOpenForUser } from '../db/candidatures.js';

const COOLDOWN_MS = 60_000;
const lastPostByUser = new Map<string, number>(); // userId -> lastTimestamp

function makeJumpLink(gid: string, cid: string, mid: string) {
  return `https://discord.com/channels/${gid}/${cid}/${mid}`;
}

export async function onCandidatureMessage(msg: Message) {
  try {
    if (msg.author.bot || msg.webhookId || !msg.guild) return;
    if (msg.channelId !== CHANNEL_IDS.CANDIDATURES) return;

    // ignore si officier
    const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (member?.roles.cache.has(ROLE_IDS.OFFICIERS)) return;

    // cooldown anti spam
    const now = Date.now();
    const last = lastPostByUser.get(msg.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    lastPostByUser.set(msg.author.id, now);

    // 1 seule “open” par user
    if (hasOpenForUser(msg.author.id)) {
      // Tu peux ping léger ici si tu veux informer l’utilisateur
      return;
    }

    // insert en DB — on utilise l’ID du message comme PK (unique)
    const jumpLink = makeJumpLink(msg.guild.id, msg.channelId, msg.id);
    insertCandidature({
      id: String(msg.id),
      user_id: String(msg.author.id),
      created_at: new Date(msg.createdTimestamp ?? Date.now()).toISOString(),
      channel_id: String(msg.channelId),
      message_url: jumpLink,
      has_attachments: msg.attachments?.size ? 1 : 0,
      status: 'open',
    });

    // notifier les Officiers
    const emb = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle('📬 Nouvelle candidature')
      .setDescription(`${msg.author} a posté dans <#${CHANNEL_IDS.CANDIDATURES}>`)
      .addFields(
        { name: 'ID', value: `\`${msg.id}\``, inline: true },
        { name: 'Lien', value: `[Ouvrir la candidature](${jumpLink})`, inline: true },
      )
      .setFooter({ text: 'Ajoutée à la liste des candidatures ouvertes' })
      .setTimestamp();

    if (msg.content) {
      const preview = msg.content.trim().slice(0, 400);
      if (preview) emb.addFields({ name: 'Aperçu', value: preview });
    }

    const content = `<@&${ROLE_IDS.OFFICIERS}> — nouvelle candidature de ${msg.author} (ID \`${msg.id}\`)`;
    await sendToChannel(msg.client, CHANNEL_IDS.RETOURS_BOT, { content, embeds: [emb] });

  } catch (e) {
    console.error('[candidatureWatcher] error:', e);
  }
}
