import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';
import { pushLog } from '../http/logs.js';

const CH = {
  READ_FIRST: CHANNEL_IDS.LIRE_PREMIER!,
  ABOUT:      CHANNEL_IDS.A_PROPOS,
  RULES:      CHANNEL_IDS.REGLEMENT,
  SERVERINFO: CHANNEL_IDS.INFOS_SERVEUR!,
  APPLY:      CHANNEL_IDS.CANDIDATURES!,
  INTRO:      CHANNEL_IDS.PRESENTATION!,
};

export const data = new SlashCommandBuilder()
  .setName('infoserveur')
  .setDescription('Guide de bienvenue et infos utiles')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: false }); // PUBLIC

    const lines = [
      `• Commence par <#${CH.READ_FIRST}>`,
      `• À propos du projet : <#${CH.ABOUT}>`,
      `• Règlement : <#${CH.RULES}>`,
      `• Infos serveur : <#${CH.SERVERINFO}>`,
      '',
      `Si tu veux rejoindre la guilde :`,
      `1) Postule dans <#${CH.APPLY}> (lis le modèle épinglé)`,
      `2) Présente-toi dans <#${CH.INTRO}>`,
      '',
      `N’hésite pas à ping le rôle <@&${ROLE_IDS.OFFICIERS}> si tu as besoin d’aide !`,
    ].join('\n');

    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'infoserveur',
      msg: `/infoserveur utilisé par ${interaction.user.tag} (${interaction.user.id})`,
      meta: { userId: interaction.user.id },
    });

    const emb = makeEmbed({
      title: '🧭 Bienvenue — informations clés',
      description: lines,
      footer: 'Besoin d’aide ? Ping le rôle Officiers avec modération.',
      timestamp: new Date(),
    });

    await interaction.editReply({ embeds: [emb] });
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /infoserveur.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'infoserveur',
      msg: `Erreur sur /infoserveur par ${interaction.user.tag} (${interaction.user.id})`,
      meta: { userId: interaction.user.id, error: String(e) },
    });
  }
}
export default { data, execute };
