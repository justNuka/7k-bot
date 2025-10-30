import 'dotenv/config';

import type { ChatInputCommandInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import path from 'node:path';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { pushLog } from '../http/logs.js';

const GDOC_URL = process.env.GDOC_URL!;

export const data = new SlashCommandBuilder()
  .setName('gdoc')
  .setDescription('Lien du Google Doc (tierlist + infos héros) avec QR code')
  .addBooleanOption(o =>
    o.setName('public')
      .setDescription('Afficher pour tout le canal (défaut: privé)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPublic = interaction.options.getBoolean('public') ?? false;

  try {
    // on ne defer pas: on répond directement avec ephemeral si demandé
    const qrPath = path.resolve(process.cwd(), 'src/public/bitly_qr_code/qr_code_gdoc.png');
    const logoPath = path.resolve(process.cwd(), 'src/public/logo_banniere/logo_masamune.png');
    const files: AttachmentBuilder[] = [];

    const qr = new AttachmentBuilder(qrPath).setName('qrcode_gdoc.png');
    files.push(qr);

    // logo facultatif en miniature
    let thumb: string | undefined = undefined;
    try {
      const logo = new AttachmentBuilder(logoPath).setName('logo_masamune.png');
      files.push(logo);
      thumb = 'attachment://logo_masamune.png';
    } catch {
      /* ignore si pas de logo */
    }

    if (!GDOC_URL) { 
      await interaction.reply({ content: 'GDOC_URL manquant côté serveur.', ephemeral: true });
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'gdoc',
        msg: `[CMD] gdoc returned an error stating that the gdoc URL is missing. Command used by ${interaction.user.tag} (${interaction.user.id}), public=${isPublic}.`,
        meta: { userId: interaction.user.id, public: isPublic }
      });

      return;
    }

    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'gdoc',
      msg: `[CMD] gdoc used by ${interaction.user.tag} (${interaction.user.id}), public=${isPublic}`,
      meta: { userId: interaction.user.id, public: isPublic }
    });

    const embed = makeEmbed({
      title: '📚 Tierlist & Guides — Google Doc',
      description: [
        '• **Tout-en-un** : tierlist, builds, teams (PVP, PVE, Tower of trials), etc...',
        '• Salon ressources disponible : ' + `<#${process.env.RESSOURCES_CHANNEL_ID}>`,
        '• Lien court : ' + GDOC_URL,
        '• Ou scanne le QR ci-dessous.'
      ].join('\n'),
      thumbnail: thumb,
      footer: 'Masamune ne possède aucun droit sur le Google Doc, il a été créé et est maintenu par 7KDreamerPlays.',
    }).setImage('attachment://qrcode_gdoc.png');

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Ouvrir le Google Doc')
        .setStyle(ButtonStyle.Link)
        .setURL(GDOC_URL)
    );

    await interaction.reply({
      embeds: [embed],
      files,
      components: [buttons],
      ephemeral: !isPublic
    });
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Impossible d’envoyer le GDoc pour le moment.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'gdoc',
      msg: `[CMD] gdoc error for ${interaction.user.tag} (${interaction.user.id})`,
      meta: { userId: interaction.user.id, error: (e as Error).message }
    });
  }
}

export default { data, execute };
