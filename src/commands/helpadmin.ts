import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { ROLE_IDS, CHANNEL_IDS } from '../config/permissions.js';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function isOfficer(member: GuildMember | null | undefined) {
  return !!(member && ROLE_IDS.OFFICIERS && member.roles.cache.has(ROLE_IDS.OFFICIERS));
}

async function statIfExists(p: string) {
  try {
    const s = await fs.stat(p);
    return `${(s.size/1024).toFixed(1)} KB • ${new Date(s.mtimeMs).toLocaleString()}`;
  } catch { return '—'; }
}

export const data = new SlashCommandBuilder()
  .setName('helpadmin')
  .setDescription('Résumé configuration/env du bot (officiers uniquement)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n); // cachée par défaut, à activer pour Officiers via Integrations (ou laisse cachée, on gate au runtime)

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const gm = interaction.inGuild()
      ? await interaction.guild!.members.fetch(interaction.user.id).catch(() => null)
      : null;

    if (!isOfficer(gm)) {
      return interaction.reply({ content: '❌ Commande réservée aux **officiers**.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // ENV visibles (jamais loguer des secrets)
    const envMode = process.env.NODE_ENV ?? 'unknown';
    const tz = process.env.RESET_CRON_TZ ?? 'Europe/Paris';
    const cronDaily = process.env.RESET_CRON ?? 'n/a';
    const cronWeekly = process.env.CR_WEEKLY_RESET_CRON ?? 'n/a';
    const guildId = process.env.GUILD_ID ?? 'n/a';

    // Fichiers de data
    const base = process.cwd();
    const countersPath = path.resolve(base, 'src/data/crCounters.json');
    const weekPath     = path.resolve(base, 'src/data/crWeek.json');
    const countersInfo = await statIfExists(countersPath);
    const weekInfo     = await statIfExists(weekPath);

    const fields = [
      {
        name: '🌐 Environnement',
        value: [
          `• NODE_ENV : \`${envMode}\``,
          `• TZ : \`${tz}\``,
          `• Versions : Node \`${process.version}\` • OS \`${os.platform()} ${os.release()}\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🗂 Guild & Salons',
        value: [
          `• Guild ID : \`${guildId}\``,
          `• CR logs : ${CHANNEL_IDS.CR_LOGS ? `<#${CHANNEL_IDS.CR_LOGS}>` : '—'}`,
          `• Ressources : ${CHANNEL_IDS.RESSOURCES ? `<#${CHANNEL_IDS.RESSOURCES}>` : '—'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎭 Rôles',
        value: [
          `• Officiers : ${ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}>` : '—'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '⏰ Cron',
        value: [
          `• Reset quotidien : \`${cronDaily}\``,
          `• Reset hebdo CR : \`${cronWeekly}\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '💾 Données',
        value: [
          `• crCounters.json : ${countersInfo}`,
          `• crWeek.json : ${weekInfo}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔒 Secrets',
        value: 'Les tokens/IDs sensibles ne sont **jamais** affichés ici.',
        inline: false,
      },
    ];

    const embed = makeEmbed({
      title: '🛠️ Aide Admin — Configuration du bot',
      description: 'Vue d’ensemble de la config actuelle (ephemeral).',
      fields,
      footer: 'Utilise /help pour la doc utilisateur. Cette commande est réservée aux Officiers.'
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Impossible d’afficher la configuration.');
  }
}

export default { data, execute };
