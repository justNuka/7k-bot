// src/handlers/notifButtons.ts
import type { ButtonInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { ROLE_IDS } from '../config/permissions.js';
import { refreshPanelAll } from '../utils/notifPanel.js';

function roleFromKey(key: 'cr'|'daily'|'gvg') {
  return key === 'cr' ? ROLE_IDS.NOTIF_CR
    : key === 'daily' ? ROLE_IDS.NOTIF_DAILY
    : ROLE_IDS.NOTIF_GVG;
}

export async function handleNotifButton(i: ButtonInteraction) {
  try {
    if (!i.inGuild()) {
      return i.reply({ content: 'Cette action doit être faite depuis le serveur.', ephemeral: true });
    }

    const m = /^notif:toggle:(cr|daily|gvg)$/.exec(i.customId);
    if (!m) return; // pas pour nous

    const key = m[1] as 'cr'|'daily'|'gvg';
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
    console.error('[notif button] role toggle fail', e);
    // Si on n’a pas encore répondu, on reply ; sinon on edit.
    if (i.deferred || i.replied) {
      await i.editReply({ content: '❌ Impossible de modifier ton rôle (permissions ?).' });
    } else {
      await i.reply({ content: '❌ Impossible de modifier ton rôle (permissions ?).', ephemeral: true });
    }
  }
}
