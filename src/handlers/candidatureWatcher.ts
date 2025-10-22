import { Colors, EmbedBuilder, Message } from 'discord.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { sendToChannel } from '../utils/send.js';
import { loadCandStore, saveCandStore, makeJumpLink } from '../utils/candidatures.js';

const COOLDOWN_MS = 60_000;
const lastPostByUser = new Map<string, number>(); // userId -> lastTimestamp

export async function onCandidatureMessage(msg: Message) {
  try {
    if (msg.author.bot || msg.webhookId || !msg.guild) return;
    if (msg.channelId !== CHANNEL_IDS.CANDIDATURES) return;

    // si officier → ignore (on ne ping pas)
    const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (member?.roles.cache.has(ROLE_IDS.OFFICIERS)) return;

    // cooldown anti spam
    const now = Date.now();
    const last = lastPostByUser.get(msg.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return; // ignore silence
    lastPostByUser.set(msg.author.id, now);

    // store: 1 seule candidature "open" à la fois pour un user
    const store = await loadCandStore();
    const alreadyOpen = store.open.some(o => o.userId === msg.author.id);
    if (alreadyOpen) {
      // on peut juste dropper (ou ping léger si tu veux)
      return;
    }

    // créer l’entrée
    const id = store.nextId++;
    const jumpLink = makeJumpLink(msg.guild.id, msg.channelId, msg.id);
    const entry = {
      id,
      userId: msg.author.id,
      createdAt: new Date().toISOString(),
      guildId: msg.guild.id,
      channelId: msg.channelId,
      messageId: msg.id,
      jumpLink,
    };
    store.open.push(entry);
    await saveCandStore(store);

    // notifier les Officiers
    const emb = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle('📬 Nouvelle candidature')
      .setDescription(`${msg.author} a posté dans <#${CHANNEL_IDS.CANDIDATURES}>`)
      .addFields(
        { name: 'File #', value: `\`${id}\``, inline: true },
        { name: 'Lien', value: `[Ouvrir la candidature](${jumpLink})`, inline: true },
      )
      .setFooter({ text: 'Ajoutée à la liste des candidatures ouvertes' })
      .setTimestamp();

    // aperçu si Message Content Intent actif
    if (msg.content) {
      const preview = msg.content.trim().slice(0, 400);
      if (preview) emb.addFields({ name: 'Aperçu', value: preview });
    }

    const content = `<@&${ROLE_IDS.OFFICIERS}> — nouvelle candidature de ${msg.author} (file #${id})`;
    await sendToChannel(msg.client, CHANNEL_IDS.RETOURS_BOT, { content, embeds: [emb] });

  } catch (e) {
    console.error('[candidatureWatcher] error:', e);
  }
}
