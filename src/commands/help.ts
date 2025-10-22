// src/commands/help.ts
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Affiche les commandes disponibles du bot (adapté à ton rôle)')
  .addBooleanOption(o =>
    o.setName('public')
      .setDescription('Afficher pour tout le canal (défaut: privé)')
  );

function isOfficer(member: GuildMember | null | undefined) {
  const roleId = ROLE_IDS.OFFICIERS;
  return !!(member && roleId && member.roles.cache.has(roleId));
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPublic = interaction.options.getBoolean('public') ?? false;

  try {
    const gm = interaction.inGuild()
      ? await interaction.guild!.members.fetch(interaction.user.id).catch(() => null)
      : null;

    const officer = isOfficer(gm);

    // --- Bloc commandes publiques (toujours visibles) ---
    const publicFields = [
      {
        name: '📖 `/help`',
        value: [
          '**Objet** : affiche cette aide',
          '**Options** : `public:true|false` (défaut: privé)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📚 `/gdoc`',
        value: [
          '**Objet** : lien Google Doc (tierlist & guides) + QR code',
          '**Options** : `public:true|false`',
          `**Ressources** : poste dans <#${CHANNEL_IDS.RESSOURCES ?? '—'}> si configuré.`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏰 `/infoserveur`',
        value: [
          '**Objet** : infos salons, rôles, reset CR',
          '**Options** : `public:true|false`',
        ].join('\n'),
        inline: false,
      },
    ];

    // --- Bloc commandes Officiers (actuelles + à venir) ---
    const officerFields = [
      {
        name: '⚔️ `/oubli-cr` (officiers, salon autorisé)',
        value: [
          `**Salon** : <#${CHANNEL_IDS.CR_LOGS ?? '—'}> (obligatoire)`,
          '**Sous-commandes actuelles** :',
          '• `add membre:@User jour:{Lun..Dim}` — enregistre un oubli (+1 global & hebdo)',
          '• `week` — récap hebdomadaire (lun→dim)',
          '• `top` — top global (all-time)',
          '• `reset total [membre]` — remet à 0 un compteur global (ou avertit si tout le monde)',
          '• `reset week` — remet à zéro le suivi hebdomadaire',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📉 `/low-score`',
        value: [
          `**Salon** : <#${CHANNEL_IDS.CR_LOGS ?? '—'}>`,
          '• `add membre:@User jour:{Lun..Dim} score:<n> [note]`',
          '• `week` — récap des low scores par jour',
          '• `reset week` — purge hebdo',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔔 `/notif` {sub-command}',
        value: [
          '• `add` : Ajouter une notification plannifiée',
          '• `edit` : Modifier une notification existante',
          '• `list` : Lister les notifications planifiées',
          '• `remove` : Supprimer une notification planifiée',
          '• `test` : Envoyer une notification de test immédiatement',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔔 `/notifpanel`',
        value: [
          '• `Publie le panneau d\'inscription aux rappels`',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎯 `/banniere` {sub-command}',
        value: [
          '• `add` : Ajouter une bannière',
          '• `list` : Lister les bannières',
          '• `next` : Afficher la prochaine bannière',
          '• `remove` : Supprimer une bannière',
          '• `edit` : Modifier une bannière',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🛡️ `/roleset` {sub-command}',
        value: [
          '• `add` : Ajoute un rôle à un utilisateur',
          '• `remove` : Retirer un rôle à un utilisateur',
          '• `swap` : Échanger deux rôles d\'un utilisateur',
        ].join('\n'),
        inline: false,
      },
    ];

    const title = officer
      ? '📖 7K Rebirth — Aide (Officiers)'
      : '📖 7K Rebirth — Aide';

    
    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'help',
      msg: `[HELP] Commande /help utilisée par ${interaction.user.tag} (${interaction.user.id}), officer: ${officer}, public: ${isPublic}`,
      meta: { userId: interaction.user.id, officer, isPublic }
    });

    const embed = makeEmbed({
      title,
      description: officer
        ? 'Tu vois ci-dessous les **commandes publiques** et les **commandes officiers**.'
        : 'Tu vois ci-dessous les **commandes publiques** disponibles.',
      fields: officer ? [...publicFields, ...officerFields] : publicFields,
      footer: 'Astuce: /help public:true pour partager au canal.',
    });

    await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Impossible d’afficher l’aide pour le moment.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'help',
      msg: `[HELP] Erreur lors de l'utilisation de /help par ${interaction.user.tag} (${interaction.user.id}): ${e}`,
      meta: { userId: interaction.user.id, error: String(e) }
    });
  }
}

export default { data, execute };
