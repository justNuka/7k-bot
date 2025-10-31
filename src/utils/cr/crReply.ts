import type { ChatInputCommandInteraction, InteractionReplyOptions, InteractionEditReplyOptions } from 'discord.js';
import { CHANNEL_IDS, ROLE_IDS } from '../../config/permissions.js';
import { MIRROR_PING_BLOCKLIST, MIRROR_PING_ALLOWLIST, cmdKey } from '../../config/mirror.js';
import { sendToChannel } from '../discord/send.js';

/** Vérifie qu'on est bien dans #cr-logs (par sécurité). */
function assertCrLogs(i: ChatInputCommandInteraction) {
  if (!i.inGuild()) return false;
  return i.channelId === CHANNEL_IDS.CR_LOGS;
}

/** Defer PUBLIC (jamais ephemeral) + retour si on est dans cr-logs. */
export async function crDefer(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: false });
  return assertCrLogs(i);
}

/** Edit PUBLIC + trace dans OFFICERS_BOT. */
export async function crEdit(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  // réponse publique dans #cr-logs
  if (typeof options === 'string') {
    await i.editReply({ content: options });
  } else {
    const { ephemeral, ...rest } = options as InteractionReplyOptions;
    await i.editReply(rest as InteractionEditReplyOptions);
  }

  // miroir dans #commande-bot
  await mirrorTrace(i, options);
}

/** Reply PUBLIC (sans defer) + trace. */
export async function crReply(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  if (typeof options === 'string') {
    await i.reply({ content: options, ephemeral: false });
  } else {
    await i.reply({ ...(options as InteractionReplyOptions), ephemeral: false });
  }
  await mirrorTrace(i, options);
}

/** Envoie une trace dans OFFICERS_BOT avec contexte. */
async function mirrorTrace(i: ChatInputCommandInteraction, options: string | InteractionReplyOptions) {
  if (!CHANNEL_IDS.RETOURS_BOT) return;

  const sub = i.isChatInputCommand() ? (i.options.getSubcommand(false) || '') : '';
  const key = cmdKey(i.commandName, sub);

  // 1) coupe le miroir si blocklist
  if (MIRROR_PING_BLOCKLIST.has(key) || MIRROR_PING_BLOCKLIST.has(i.commandName ?? '')) return;

  // 2) ping conditionnel pour CR
  const mention = (MIRROR_PING_ALLOWLIST.has(key) || MIRROR_PING_ALLOWLIST.has(i.commandName ?? ''))
    ? (ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}> ` : '')
    : '';

  const header = `${mention}🧾 **Trace CR** — par <@${i.user.id}> depuis <#${i.channelId}>`;

  if (typeof options === 'string') {
    await sendToChannel(i.client, CHANNEL_IDS.RETOURS_BOT, `${header}\n\n${options}`);
  } else {
    const payload = {
      content: options.content ? `${header}\n\n${options.content}` : header,
      embeds: options.embeds,
      components: options.components,
      files: (options as any).files,
    };
    await sendToChannel(i.client, CHANNEL_IDS.RETOURS_BOT, payload as any);
  }
}

