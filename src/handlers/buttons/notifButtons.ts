/**
 * Handler pour les boutons de notification
 * 
 * Gère les boutons permettant aux utilisateurs de toggle leurs rôles de notification
 * pour différents types d'événements (CR, Daily, GVG).
 * 
 * Format du customId : `notif:toggle:<type>`
 * Où <type> peut être : `cr`, `daily`, `gvg`
 * 
 * @module handlers/buttons/notifButtons
 */

import type { ButtonInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { ROLE_IDS } from '../../config/permissions.js';
import { refreshPanelAll } from '../../utils/notifPanel.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('NotifButtons');

/**
 * Résout l'ID de rôle correspondant à un type de notification
 * 
 * @param key Type de notification (cr, daily, gvg, annonces)
 * @returns ID du rôle Discord correspondant
 */
function roleFromKey(key: 'cr'|'daily'|'gvg'|'annonces'): string {
  return key === 'cr' ? ROLE_IDS.NOTIF_CR
    : key === 'daily' ? ROLE_IDS.NOTIF_DAILY
    : key === 'gvg' ? ROLE_IDS.NOTIF_GVG
    : ROLE_IDS.NOTIF_ANNONCES_JEU;
}

/**
 * Gère les interactions de boutons de notification
 * 
 * Ajoute ou retire le rôle de notification correspondant à l'utilisateur.
 * Rafraîchit automatiquement le panel de notifications après modification.
 * 
 * @param i Interaction de bouton Discord
 */
export async function handleNotifButton(i: ButtonInteraction) {
  try {
    if (!i.inGuild()) {
      return i.reply({ content: 'Cette action doit être faite depuis le serveur.', ephemeral: true });
    }

    const m = /^notif:toggle:(cr|daily|gvg|annonces)$/.exec(i.customId);
    if (!m) return; // pas pour nous

    const key = m[1] as 'cr'|'daily'|'gvg'|'annonces';
    const roleId = roleFromKey(key);
    if (!roleId) {
      return i.reply({ content: 'Rôle de rappel non configuré.', ephemeral: true });
    }

    // On défer pour garantir qu’on répond au plus tard dans 3s
    await i.deferReply({ ephemeral: true });

    const member = await i.guild!.members.fetch(i.user.id).catch(() => null) as GuildMember | null;
    if (!member) {
      return i.editReply({ content: 'Utilisateur introuvable.' });
    }

    // Toggle
    const has = member.roles.cache.has(roleId);
    if (has) {
      await member.roles.remove(roleId, 'Unsubscribe notif');
      await i.editReply({ content: '✅ Désabonné du rappel.' });
    } else {
      await member.roles.add(roleId, 'Subscribe notif');
      await i.editReply({ content: '✅ Abonné au rappel.' });
    }

    // Rafraîchit compteurs (labels des boutons + embed du panel)
    await refreshPanelAll(i.client);

  } catch (e) {
    log.error({ userId: i.user.id, error: e }, 'Échec toggle rôle notification');
    // Si on n'a pas encore répondu, on reply ; sinon on edit.
    if (i.deferred || i.replied) {
      await i.editReply({ content: '❌ Impossible de modifier ton rôle (permissions ?).' });
    } else {
      await i.reply({ content: '❌ Impossible de modifier ton rôle (permissions ?).', ephemeral: true });
    }
  }
}
