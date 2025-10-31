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
          '**Objet** : affiche cette aide adaptée à ton rôle',
          '**Options** : `public:true|false` (défaut: privé)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📚 `/gdoc`',
        value: [
          '**Objet** : lien Google Doc (tierlist & guides) + QR code',
          '**Options** : `public:true|false`',
          `**Ressources** : poste dans <#${CHANNEL_IDS.RESSOURCES ?? '—'}> si configuré`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏰 `/infoserveur`',
        value: [
          '**Objet** : guide de bienvenue et infos utiles',
          '**Options** : `public:true|false`',
          '→ Infos salons, rôles, reset CR, règles',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 `/absence add`',
        value: [
          '**Objet** : déclarer une absence',
          '**Dates** : formats intuitifs acceptés !',
          '• Mots-clés : `demain`, `lundi`, `dans 3 jours`',
          '• Naturel : `4 novembre`, `vendredi`',
          '• Classique : `15/11/2025`, `YYYY-MM-DD`',
          '**Options** : `raison` et `note` (optionnels)',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🆘 `/coaching`',
        value: [
          '**Objet** : demander un coaching ou une aide',
          '**Options** :',
          '• `type` : `coaching` ou `aide`',
          '• `message` : ta demande détaillée',
          '→ Transmis aux Officiers dans le salon retours bot',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚨 `/pingoff`',
        value: [
          '**Objet** : alerter les Officiers rapidement',
          '**Motifs** : `remonter_info` | `signaler_membre` | `autre`',
          '**Options** :',
          '• `message` : ton message',
          '• `officier` (opt.) : notifier un Officier précis',
          '→ Sans officier : message + ping rôle Officiers',
          '→ Avec officier : DM direct ou fil privé',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📋 `/changelog`',
        value: [
          '**Objet** : affiche les dernières mises à jour du bot',
          '→ Nouvelles fonctionnalités, corrections, améliorations',
        ].join('\n'),
        inline: false,
      },
    ];

    // --- Bloc commandes Officiers ---
    const officerFields = [
      {
        name: '👥 `/candidatures list`',
        value: [
          '**Objet** : gérer les candidatures des membres',
          '→ Affiche les candidatures avec IDs courts (C-XXX)',
          '→ Boutons inline pour accepter/refuser',
          '→ Roleswap automatique : RECRUES → MEMBRES (accepté) ou VISITEURS (refusé)',
          '→ Messages DM détaillés envoyés au candidat',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 `/absence list`',
        value: [
          '**Objet** : consulter les absences déclarées',
          '→ Affiche les absences en cours et à venir',
          '→ Filtres : membre, date de début/fin, raison',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚔️ `/oubli-cr`',
        value: [
          `**Salon** : <#${CHANNEL_IDS.CR_LOGS ?? '—'}> uniquement`,
          '**Sous-commandes** :',
          '• `add` : enregistre un oubli (+1 global & hebdo)',
          '• `week` : récap hebdomadaire (lun→dim)',
          '• `top` : classement global (10 premiers)',
          '• `reset total [membre]` : remet à 0 compteur(s)',
          '• `reset week` : réinit le suivi hebdomadaire',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📉 `/low-score`',
        value: [
          `**Salon** : <#${CHANNEL_IDS.CR_LOGS ?? '—'}>`,
          '**Sous-commandes** :',
          '• `add` : enregistre un low score',
          '• `week` : récap des low scores par jour',
          '• `reset week` : purge hebdomadaire',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎯 `/banniere`',
        value: [
          '**Objet** : gérer les bannières du jeu',
          '**Dates intuitives** : `demain`, `lundi`, `15/11/2025`, etc.',
          '**Sous-commandes** :',
          '• `add` : ajouter une bannière',
          '• `list` : lister les bannières à venir',
          '• `next` : prochaine bannière',
          '• `edit` : modifier une bannière (autocomplete ID)',
          '• `remove` : supprimer une bannière',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔔 `/notif`',
        value: [
          '**Objet** : notifications automatiques plannifiées',
          '**Sous-commandes** :',
          '• `add` : créer une notif (rôle, salon, heure, fréquence)',
          '• `list` : lister les notifs actives',
          '• `edit` : modifier une notif existante',
          '• `remove` : supprimer une notif',
          '• `test` : tester l\'envoi immédiat',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔔 `/notifpanel`',
        value: [
          '**Objet** : publie le panneau d\'inscription aux rappels',
          '→ Membres peuvent s\'abonner/désabonner avec boutons',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🛡️ `/roleset`',
        value: [
          '**Objet** : gestion avancée des rôles',
          '**Sous-commandes** :',
          '• `add` : ajouter un rôle à un membre',
          '• `remove` : retirer un rôle',
          '• `swap` : échanger deux rôles',
        ].join('\n'),
        inline: false,
      },
      {
        name: '👟 `/kick`',
        value: [
          '**Objet** : expulser un membre avec message personnalisé',
          '→ Templates pré-définis ou message custom',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚨 `/signalement`',
        value: [
          '**Objet** : gérer les signalements de membres',
          '**Sous-commandes** :',
          '• `add` : créer un signalement',
          '• `list` : lister les signalements',
          '• `view` : voir détails d\'un signalement',
          '• `close` : clôturer un signalement',
        ].join('\n'),
        inline: false,
      },
      {
        name: '� `/yt`',
        value: [
          '**Objet** : suivi des chaînes YouTube (Seven Knights)',
          '**Sous-commandes** :',
          '• `add` : ajouter une chaîne à suivre',
          '• `remove` : supprimer une chaîne',
          '• `list` : lister les chaînes suivies',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎬 `/ytroute`',
        value: [
          '**Objet** : routage automatique des vidéos YT',
          '→ Filtre par regex (ex: "infinite|tower")',
          '→ Poste dans des threads spécifiques',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔧 `/diag`',
        value: [
          '**Objet** : diagnostics système du bot',
          '→ Santé DB, jobs, mémoire, uptime',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚙️ `/helpadmin`',
        value: [
          '**Objet** : configuration technique du bot',
          '→ ENV, crons, fichiers data, versions',
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
