import type { ChatInputCommandInteraction, TextChannel, InteractionReplyOptions, InteractionEditReplyOptions } from 'discord.js';
import { CHANNEL_IDS, ROLE_IDS } from '../../config/permissions.js';
import { MIRROR_PING_BLOCKLIST, MIRROR_PING_ALLOWLIST, cmdKey } from '../../config/mirror.js';
import { sendToChannel } from '../discord/send.js';

function inOfficerChannel(i: ChatInputCommandInteraction) {
  return i.inGuild() && CHANNEL_IDS.RETOURS_BOT && i.channelId === CHANNEL_IDS.RETOURS_BOT;
}

/** Defer en gérant l’ephemeral si on n’est PAS dans le salon officiers. */
export async function officerDefer(i: ChatInputCommandInteraction) {
  const inside = inOfficerChannel(i);
  await i.deferReply({ ephemeral: !inside });
  return inside;
}

/**
 * Répond :
 * - si on est DANS le salon officiers → réponse normale (publique dans ce salon)
 * - sinon → réponse ephemeral + miroir dans le salon officiers
 *
 * À utiliser quand tu n’as PAS fait de defer.
 */
export async function officerReply(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  const inside = inOfficerChannel(i);

  // 1) répondre à l’auteur
  if (typeof options === 'string') {
    await i.reply({ content: options, ephemeral: !inside });
  } else {
    await i.reply({ ...options, ephemeral: !inside });
  }

  // 2) si hors salon → miroir
  if (!inside && CHANNEL_IDS.RETOURS_BOT) {
    await mirrorToOfficers(i, options);
  }
}

/**
 * Finaliser après un defer :
 * - si dans le salon → editReply
 * - sinon → editReply (ephemeral) + miroir dans OFFICERS_BOT
 */
export async function officerEdit(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  const inside = inOfficerChannel(i);

  if (typeof options === 'string') {
    await i.editReply({ content: options });
  } else {
    // ne JAMAIS remettre ephemeral ici (géré au defer)
    const { ephemeral, ...rest } = options as InteractionReplyOptions;
    await i.editReply(rest as InteractionEditReplyOptions);
  }

  if (!inside && CHANNEL_IDS.RETOURS_BOT) {
    await mirrorToOfficers(i, options);
  }
}

/** Defer PUBLIC si dans le salon officiers, sinon ephemeral. */
export async function officerDeferPublic(i: ChatInputCommandInteraction) {
  const inside = i.inGuild() && CHANNEL_IDS.RETOURS_BOT && i.channelId === CHANNEL_IDS.RETOURS_BOT;
  await i.deferReply({ ephemeral: false }); // toujours PUBLIC
  return inside;
}


/** Poste une copie contextualisée dans le salon officiers. */
async function mirrorToOfficers(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  if (!CHANNEL_IDS.RETOURS_BOT) return;

  const sub = i.isChatInputCommand() ? (i.options.getSubcommand(false) || '') : '';
  const key = cmdKey(i.commandName, sub);

  // 1) Si blocklist → on ne mirror PAS.
  if (MIRROR_PING_BLOCKLIST.has(key) || MIRROR_PING_BLOCKLIST.has(i.commandName ?? '')) return;

  // 2) Ping conditionnel
  const mention = (MIRROR_PING_ALLOWLIST.has(key) || MIRROR_PING_ALLOWLIST.has(i.commandName ?? ''))
    ? (ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}> ` : '')
    : '';

  const header = `${mention}🔐 **Action officiers** — par <@${i.user.id}> depuis <#${i.channelId}>`;

  if (typeof options === 'string') {
    await sendToChannel(i.client, CHANNEL_IDS.RETOURS_BOT!, `${header}\n\n${options}`);
  } else {
    const payload = {
      content: options.content ? `${header}\n\n${options.content}` : header,
      embeds: options.embeds,
      components: options.components,
      files: (options as any).files,
    };
    await sendToChannel(i.client, CHANNEL_IDS.RETOURS_BOT!, payload as any);
  }
}

