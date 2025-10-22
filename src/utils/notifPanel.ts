import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client, type Guild } from 'discord.js';
import { readJson, writeJson } from './storage.js';
import { ROLE_IDS } from '../config/permissions.js';
import { makeEmbed } from './embed.js';

const STORE_PATH = 'src/data/notifPanel.json';

type PanelStore = { channelId: string; messageId: string };

export async function savePanelRef(ref: PanelStore) {
  await writeJson(STORE_PATH, ref);
}
export async function loadPanelRef(): Promise<PanelStore | null> {
  return await readJson<PanelStore | null>(STORE_PATH, null);
}

function countRole(guild: Guild, roleId?: string) {
  if (!roleId) return 0;
  const role = guild.roles.cache.get(roleId);
  return role?.members.size ?? 0;
}

export function buildPanelComponents(guild: Guild) {
  const crCount    = countRole(guild, ROLE_IDS.NOTIF_CR);
  const dailyCount = countRole(guild, ROLE_IDS.NOTIF_DAILY);
  const gvgCount   = countRole(guild, ROLE_IDS.NOTIF_GVG);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('notif:toggle:cr')
        .setLabel(`Rappel CR (${crCount})`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId('notif:toggle:daily')
        .setLabel(`Rappel Daily (${dailyCount})`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('🧱'),
      new ButtonBuilder()
        .setCustomId('notif:toggle:gvg')
        .setLabel(`Rappel GvG (${gvgCount})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚔️'),
    )
  ];
}

/** Met à jour les **boutons (compteurs)** */
export async function refreshPanelMessage(client: Client) {
  const ref = await loadPanelRef();
  if (!ref) return;
  const chan = await client.channels.fetch(ref.channelId).catch(() => null);
  if (!chan || !chan.isTextBased()) return;

  const guild = ('guild' in chan && chan.guild) ? chan.guild : null;
  if (!guild) return;

  const components = buildPanelComponents(guild);
  const msg = await chan.messages.fetch(ref.messageId).catch(() => null);
  if (msg) await msg.edit({ components });
}

/** Met à jour **l’embed (texte)** avec les nombres d’inscrits */
export async function updateNotifPanel(client: Client) {
  const ref = await loadPanelRef();
  if (!ref) return;
  const chan = await client.channels.fetch(ref.channelId).catch(() => null);
  if (!chan || !chan.isTextBased()) return;

  const guild = ('guild' in chan && chan.guild) ? chan.guild : null;
  if (!guild) return;

  const [nCR, nDay, nGvG] = [
    ROLE_IDS.NOTIF_CR,
    ROLE_IDS.NOTIF_DAILY,
    ROLE_IDS.NOTIF_GVG
  ].map(rid => guild.roles.cache.get(rid)?.members.size ?? 0);

  const msg = await chan.messages.fetch(ref.messageId).catch(() => null);
  if (!msg) return;

  const emb = makeEmbed({
    title: '🔔 Rappels disponibles',
    description: [
      `• Rappel **CR** : ${nCR} inscrit(s)`,
      `• Rappel **Dailies** : ${nDay} inscrit(s)`,
      `• Rappel **Début GvG** : ${nGvG} inscrit(s)`,
      '',
      `Clique sur les boutons ci-dessous pour t’inscrire / te désinscrire.`,
    ].join('\n')
  });

  await msg.edit({ embeds: [emb] });
}

/** Helper pratique pour tout rafraîchir après un toggle */
export async function refreshPanelAll(client: Client) {
  await Promise.allSettled([
    refreshPanelMessage(client),
    updateNotifPanel(client),
  ]);
}
