/**
 * Handler pour l'événement guildMemberAdd (nouveaux membres)
 * 
 * Gère l'accueil des nouveaux membres sur le serveur Discord :
 * 1. Attribution automatique du rôle "Visiteurs"
 * 2. Envoi d'un message de bienvenue avec embed stylisé
 * 3. Boutons d'action : Candidater, Voir les règles
 * 
 * Le message de bienvenue est envoyé dans le canal configuré (CHANNEL_IDS.WELCOME).
 * 
 * @module handlers/events/memberWelcome
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { ROLE_IDS, CHANNEL_IDS } from '../../config/permissions.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('MemberWelcome');

// ====== THEME / BRAND ======
/**
 * Thème visuel pour les messages de bienvenue
 */
const BRAND = {
  primary: 0x5865F2,           // Discord Blurple
  accent:  0xF59E0B,           // Amber
  logo:    'https://your.cdn/logo_7k.png',              // Logo de la guilde
  banner:  'https://your.cdn/welcome_banner.jpg',       // Bannière d'accueil
};

/**
 * Génère un lien Discord vers un canal spécifique
 * 
 * @param guildId ID du serveur Discord
 * @param channelId ID du canal (optionnel)
 * @returns URL du canal ou undefined
 */
function channelDeepLink(guildId: string, channelId?: string): string | undefined {
  return channelId ? `https://discord.com/channels/${guildId}/${channelId}` : undefined;
}

/**
 * Gère l'arrivée d'un nouveau membre sur le serveur
 * 
 * Workflow :
 * 1. Assigne automatiquement le rôle "Visiteurs"
 * 2. Crée et envoie un embed de bienvenue personnalisé
 * 3. Ajoute des boutons d'action (candidater, règles)
 * 
 * @param member Le membre qui vient de rejoindre
 */
export async function onGuildMemberAdd(member: GuildMember) {
  log.info({ tag: member.user.tag, id: member.id }, 'Nouveau membre');

  // --- 1) Auto-assign "Visiteurs"
  try {
    if (ROLE_IDS.VISITEURS) {
      const me = member.guild.members.me;
      const role = await member.guild.roles.fetch(ROLE_IDS.VISITEURS).catch(() => null);
      const canManage =
        !!me &&
        me.permissions.has(PermissionFlagsBits.ManageRoles) &&
        role &&
        me.roles.highest.comparePositionTo(role) > 0;

      if (role && canManage) {
        await member.roles.add(role, 'Auto-assign: Visiteurs');
      } else if (!canManage) {
        log.warn('Bot ne peut pas gérer le rôle VISITEURS (permission/position)');
      }
    }
  } catch (e) {
    log.error({ err: e }, 'Erreur lors de l\'ajout du rôle');
  }

  // --- 2) Build welcome embed (DM)
  const g = member.guild;
  const linksList = [
    CHANNEL_IDS.A_PROPOS       ? `• <#${CHANNEL_IDS.A_PROPOS}> — À propos` : null,
    CHANNEL_IDS.REGLEMENT      ? `• <#${CHANNEL_IDS.REGLEMENT}> — Règlement` : null,
    CHANNEL_IDS.INFOS_SERVEUR  ? `• <#${CHANNEL_IDS.INFOS_SERVEUR}> — Infos serveur` : null,
  ].filter(Boolean).join('\n');

  const wantsToJoin =
    CHANNEL_IDS.CANDIDATURES && CHANNEL_IDS.PRESENTATION
      ? `Si tu veux **rejoindre la guilde**, dépose une candidature dans <#${CHANNEL_IDS.CANDIDATURES}> et présente-toi dans <#${CHANNEL_IDS.PRESENTATION}>.`
      : `Si tu veux **rejoindre la guilde**, consulte le salon d’infos serveur pour les étapes.`;

  const welcome = new EmbedBuilder()
    .setColor(BRAND.primary)
    .setAuthor({
      name: `Bienvenue, ${member.user.username} !`,
      iconURL: member.user.displayAvatarURL({ size: 128 }),
    })
    .setTitle('Masamune • Seven Knights Rebirth')
    .setDescription([
      `Ravi de t’avoir parmi nous ${member}!`,
      '',
      'Voici les premiers salons à consulter :',
      linksList || '—',
      '',
      `🛡️ ${wantsToJoin}`,
      'Bonne aventure sur **Seven Knights Rebirth** !',
    ].join('\n'))
    .setThumbnail(BRAND.logo)
    .setImage(BRAND.banner)
    .setFooter({
      text: g.name,
      iconURL: member.client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();

  // Boutons (liens) — ouvrent directement les salons dans le client
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(CHANNEL_IDS.A_PROPOS ? [
      new ButtonBuilder()
        .setLabel('À propos')
        .setStyle(ButtonStyle.Link)
        .setURL(channelDeepLink(g.id, CHANNEL_IDS.A_PROPOS)!)
    ] : []),
    ...(CHANNEL_IDS.REGLEMENT ? [
      new ButtonBuilder()
        .setLabel('Règlement')
        .setStyle(ButtonStyle.Link)
        .setURL(channelDeepLink(g.id, CHANNEL_IDS.REGLEMENT)!)
    ] : []),
    ...(CHANNEL_IDS.INFOS_SERVEUR ? [
      new ButtonBuilder()
        .setLabel('Infos serveur')
        .setStyle(ButtonStyle.Link)
        .setURL(channelDeepLink(g.id, CHANNEL_IDS.INFOS_SERVEUR)!)
    ] : []),
  );

  // --- 3) Try DM embed + buttons
  let dmOk = true;
  try {
    await member.send({ embeds: [welcome], components: [row] });
    log.info('Message de bienvenue envoyé en DM');
  } catch (e) {
    dmOk = false;
    log.warn({ error: (e as Error).message }, 'DM échoué (DMs fermés?)');
  }

  // --- 4) Fallback dans #welcome si DM fermé
  if (!dmOk && CHANNEL_IDS.WELCOME) {
    const chan = await member.client.channels.fetch(CHANNEL_IDS.WELCOME).catch(() => null);
    if (chan && chan.isTextBased()) {
      const fallback = new EmbedBuilder()
        .setColor(BRAND.accent)
        .setTitle('👋 Nouveau membre')
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setDescription(
          [
            `${member} vient de nous rejoindre !`,
            '',
            'Pense à consulter :',
            linksList || '—',
          ].join('\n')
        )
        .setFooter({ text: 'Bienvenue !' })
        .setTimestamp();

      await (chan as TextChannel).send({
        content: `Bienvenue ${member}!`,
        embeds: [fallback],
      });
      log.info('Message fallback posté dans #welcome');
    } else {
      log.warn('Canal WELCOME invalide ou indisponible');
    }
  }
}
