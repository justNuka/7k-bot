// src/commands/coaching.ts
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { COMMAND_RULES, CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { sendToChannel } from '../utils/send.js';
import { officerDefer, officerDeferPublic, officerEdit } from '../utils/officerReply.js';
import { pushLog } from '../http/logs.js';

import {
  newCoachingId, createRequest, listOpenRequests, acceptRequest,
  closeRequest, getRequestById, listAcceptedBy
} from '../db/coaching.js';

export const data = new SlashCommandBuilder()
  .setName('coaching')
  .setDescription('Demandes d’aide / coaching')
  .setDMPermission(false)
  // Membres (tout le monde) — on ne met PAS de DefaultMemberPermissions
  .addSubcommand(sc => sc
    .setName('request')
    .setDescription('Créer une demande (help/coaching)')
    .addStringOption(o => o
      .setName('type')
      .setDescription('Type de demande')
      .setRequired(true)
      .addChoices(
        { name: 'Help rapide', value: 'help' },
        { name: 'Coaching',    value: 'coaching' }
      ))
    .addStringOption(o => o
      .setName('message')
      .setDescription('Décris le besoin (persos/équipe, mode de jeu, dispo…)')
      .setRequired(true))
  )
  // Officiers — admin subcommands
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister les demandes ouvertes (OFFICIERS)')
  )
  .addSubcommand(sc => sc
    .setName('accept')
    .setDescription('Accepter une demande (OFFICIERS)')
    .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('close')
    .setDescription('Clôturer une demande (OFFICIERS)')
    .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note de clôture').setRequired(false))
  )
  .addSubcommand(sc => sc
    .setName('mine')
    .setDescription('Voir les demandes que tu as acceptées (OFFICIERS)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);

  try {
    // --- MEMBER FLOW: /coaching request -------------------------------------
    if (sub === 'request') {
      // Réponse privée au membre (ephemeral)
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type', true) as 'help'|'coaching';
      const message = interaction.options.getString('message', true);
      const id = newCoachingId();

      createRequest({
        id,
        user_id: interaction.user.id,
        origin_channel_id: interaction.channelId,
        type,
        message
      });

      // Notif officiers dans le salon retours
      const retChanId = CHANNEL_IDS.RETOURS_BOT;
      if (retChanId) {
        const content = [
          `🆕 Demande **${type.toUpperCase()}** \`${id}\` par <@${interaction.user.id}>`,
          `> ${message}`
        ].join('\n');

        try { await sendToChannel(interaction.client, retChanId, content); } catch {}
      }

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'coaching',
        msg: `[COACH] request created ${id} by ${interaction.user.tag}`,
        meta: { id, userId: interaction.user.id, type, origin: interaction.channelId }
      });

      const emb = makeEmbed({
        title: '✅ Demande envoyée',
        description: [
          `ID : \`${id}\``,
          `Type : **${type}**`,
          `Message :`,
          `> ${message}`,
          '',
          `Un officier te contactera quand dispo.`
        ].join('\n')
      });

      return interaction.editReply({ embeds: [emb] });
    }

    // --- OFFICER FLOW: list / accept / close / mine --------------------------
    const rule = COMMAND_RULES['roleset'] ?? { roles: [ROLE_IDS.OFFICIERS], channels: [] };
    if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

    // list (publique + mirroring)
    if (sub === 'list') {
      await officerDeferPublic(interaction);
      const open = listOpenRequests();

      if (!open.length) {
        return officerEdit(interaction, 'Aucune demande ouverte.');
      }

      const lines = open.map(r =>
        `• \`${r.id}\` — <@${r.user_id}> — **${r.type}** — ${new Date(r.created_at).toLocaleString('fr-FR')} \n> ${r.message}`
      ).join('\n\n');

      return officerEdit(interaction, { embeds: [makeEmbed({
        title: '📋 Demandes ouvertes',
        description: lines
      })]});
    }

    if (sub === 'accept') {
      await officerDefer(interaction); // ephemeral + miroir
      const id = interaction.options.getString('id', true);

      const ok = acceptRequest(id, interaction.user.id);
      if (!ok) {
        return officerEdit(interaction, '❌ Impossible d’accepter (ID invalide ou déjà pris).');
      }

      // ping dans retours
      if (CHANNEL_IDS.RETOURS_BOT) {
        const r = getRequestById(id);
        if (r) {
          const msg = `🧭 Demande \`${id}\` acceptée par <@${interaction.user.id}> — demandeur: <@${r.user_id}>.`;
          try { await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, msg); } catch {}
        }
      }

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'coaching',
        msg: `[COACH] accepted ${id} by ${interaction.user.tag}`,
        meta: { id, officer: interaction.user.id }
      });

      return officerEdit(interaction, `✅ Demande \`${id}\` acceptée.`);
    }

    if (sub === 'close') {
      await officerDefer(interaction);
      const id = interaction.options.getString('id', true);
      const note = interaction.options.getString('note') ?? undefined;

      const ok = closeRequest(id, interaction.user.id, note);
      if (!ok) {
        return officerEdit(interaction, '❌ Impossible de clôturer (ID invalide).');
      }

      if (CHANNEL_IDS.RETOURS_BOT) {
        const txt = `✅ Demande \`${id}\` clôturée par <@${interaction.user.id}>.` + (note ? `\n> ${note}` : '');
        try { await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, txt); } catch {}
      }

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'coaching',
        msg: `[COACH] closed ${id} by ${interaction.user.tag}`,
        meta: { id, officer: interaction.user.id, note }
      });

      return officerEdit(interaction, `✅ Demande \`${id}\` clôturée.`);
    }

    if (sub === 'mine') {
      await officerDefer(interaction);
      const mine = listAcceptedBy(interaction.user.id);
      if (!mine.length) return officerEdit(interaction, 'Tu n’as aucune demande acceptée en cours.');

      const lines = mine.map(r =>
        `• \`${r.id}\` — <@${r.user_id}> — **${r.type}** — accepté le ${new Date(r.accepted_at ?? '').toLocaleString('fr-FR')}\n> ${r.message}`
      ).join('\n\n');

      return officerEdit(interaction, { embeds: [makeEmbed({
        title: '🗂️ Tes demandes en cours',
        description: lines
      })]});
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /coaching.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'coaching',
      msg: `[COACH] command error by ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, error: (e as Error).message }
    });
    return;
  }
}

export default { data, execute };
