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
    if (!member) return;
    if (member.roles.cache.has(ROLE_IDS.OFFICIERS)) return;

    // cooldown anti spam
    const now = Date.now();
    const last = lastPostByUser.get(msg.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    lastPostByUser.set(msg.author.id, now);

    // 1 seule "open" par user
    if (hasOpenForUser(msg.author.id)) {
      // Tu peux ping léger ici si tu veux informer l'utilisateur
      return;
    }

    // ✅ Roleswap VISITEURS → RECRUES
    let roleNote = '';
    if (ROLE_IDS.RECRUES && !member.roles.cache.has(ROLE_IDS.RECRUES)) {
      try {
        const me = msg.guild.members.me;
        const recruesRole = msg.guild.roles.cache.get(ROLE_IDS.RECRUES);
        const visiteursRole = ROLE_IDS.VISITEURS ? msg.guild.roles.cache.get(ROLE_IDS.VISITEURS) : null;
        
        const canManageRecrues = me?.permissions.has('ManageRoles') && recruesRole &&
          me.roles.highest.comparePositionTo(recruesRole) > 0;
        const canManageVisiteurs = !visiteursRole || (me?.permissions.has('ManageRoles') &&
          me.roles.highest.comparePositionTo(visiteursRole) > 0);
        
        if (canManageRecrues && canManageVisiteurs) {
          // Retirer VISITEURS si présent
          if (ROLE_IDS.VISITEURS && member.roles.cache.has(ROLE_IDS.VISITEURS)) {
            await member.roles.remove(ROLE_IDS.VISITEURS, `Candidature reçue (#${msg.id})`);
          }
          // Ajouter RECRUES
          await member.roles.add(ROLE_IDS.RECRUES, `Candidature reçue (#${msg.id})`);
          roleNote = ' — ✅ Roleswap VISITEURS → RECRUES effectué';
        } else {
          roleNote = ' — ⚠️ Impossible de faire le roleswap (permissions/hiérarchie)';
        }
      } catch (err) {
        roleNote = ` — ⚠️ Erreur roleswap: ${(err as Error).message}`;
      }
    } else if (ROLE_IDS.RECRUES && member.roles.cache.has(ROLE_IDS.RECRUES)) {
      roleNote = ' — ℹ️ A déjà le rôle RECRUES';
    }

    // insert en DB — on utilise l'ID du message comme PK (unique)
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
      .setDescription(`${msg.author} a posté dans <#${CHANNEL_IDS.CANDIDATURES}>${roleNote}`)
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
