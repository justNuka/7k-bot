// src/commands/oubliCr.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { CR_DAYS, dayLabel } from '../utils/cr.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { getWeekStartIso } from '../utils/week.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { discordAbsolute } from '../utils/time.js';
import { addCrMiss } from '../db/crWrites.js';
import { db } from '../db/db.js';

// Helpers existants chez toi
import { crDefer, crEdit } from '../utils/crReply.js';
import { pushLog } from '../http/logs.js';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const OFFICER_ROLE_ID = process.env.ROLE_OFFICIERS_ID;

async function isOfficer(i: ChatInputCommandInteraction) {
  if (!i.inGuild() || !OFFICER_ROLE_ID) return false;
  const m = await i.guild!.members.fetch(i.user.id).catch(() => null);
  return !!m?.roles.cache.has(OFFICER_ROLE_ID);
}

export const data = new SlashCommandBuilder()
  .setName('oubli-cr')
  .setDescription('Gestion des oublis Castle Rush')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .addSubcommand((sc) =>
    sc
      .setName('add')
      .setDescription('Ajoute +1 oubli à un membre (officiers)')
      .addUserOption((o) =>
        o.setName('membre').setDescription('Membre concerné').setRequired(true)
      )
      .addStringOption((o) => {
        let opt = o.setName('jour').setDescription('Jour du CR').setRequired(true);
        CR_DAYS.forEach((d) => (opt = opt.addChoices({ name: d.label, value: d.key })));
        return opt;
      })
  )
  .addSubcommand((sc) =>
    sc.setName('week').setDescription('Affiche le récap hebdomadaire (lun→dim)')
  )
  .addSubcommand((sc) =>
    sc.setName('top').setDescription('Classement global des oublis (10 premiers)')
  )
  .addSubcommandGroup((g) =>
    g
      .setName('reset')
      .setDescription('Réinitialisations (officiers)')
      .addSubcommand((sc) =>
        sc
          .setName('total')
          .setDescription('Reset des compteurs globaux')
          .addUserOption((o) =>
            o
              .setName('membre')
              .setDescription(
                'Membre à remettre à 0 (laisser vide pour tout le monde)'
              )
          )
      )
      .addSubcommand((sc) =>
        sc.setName('week').setDescription('Reset du suivi hebdomadaire')
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['oubli-cr'];
  if (
    !(await requireAccess(interaction, {
      roles: rule.roles,
      channels: rule.channels,
    }))
  )
    return;

  const sub = interaction.options.getSubcommand(true);
  const group = interaction.options.getSubcommandGroup(false);

  try {
    // Actions sensibles : add / reset → vérif officier
    if (group === 'reset' || sub === 'add') {
      if (!(await isOfficer(interaction))) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'cr',
          msg: `[CR] Unauthorized /oubli-cr ${group ? group + ' ' : ''}${sub} by ${interaction.user.tag}`,
          meta: { userId: interaction.user.id },
        });
        return interaction.reply({
          content: '❌ Commande réservée aux **officiers**.',
          ephemeral: true,
        });
      }
    }

    await crDefer(interaction);

    const weekStart = getWeekStartIso(new Date()); // YYYY-MM-DD

    // ---------------------
    // ADD
    // ---------------------
    if (sub === 'add') {
      const user = interaction.options.getUser('membre', true);
      const jour = interaction.options.getString('jour', true) as DayKey;

      // 1) enregistre l’oubli hebdo (évite les doublons)
      //    - si tu veux forcer l’unicité au niveau DB, ajoute l’index proposé
      //    - sinon, on ignore si déjà présent
      const already = db
        .prepare(
          'SELECT 1 FROM cr_week WHERE week_start = ? AND day = ? AND user_id = ? LIMIT 1'
        )
        .get(weekStart, jour, user.id);
      if (!already) {
        db.prepare(
          'INSERT INTO cr_week(week_start, day, user_id) VALUES(?, ?, ?)'
        ).run(weekStart, jour, user.id);
      }

      // 2) incrémente le compteur global
      addCrMiss(weekStart, jour, user.id);

      const { total } =
        (db
          .prepare('SELECT total FROM cr_counters WHERE user_id = ?')
          .get(user.id) as any) ?? { total: 1 };

      const member = await interaction.guild?.members
        .fetch(user.id)
        .catch(() => null);
      const name = memberDisplay(member, user.username);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Oubli ajouté: ${name} (${dayLabel(jour)}) par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id, userId: user.id, day: jour, weekStart },
      });

      return crEdit(interaction, {
        embeds: [
          makeEmbed({
            title: '➕ Oubli CR enregistré',
            description: `**${name}** → total **${total}**`,
            fields: [
              { name: 'Jour', value: dayLabel(jour), inline: true },
              { name: 'Semaine', value: discordAbsolute(weekStart, 'F'), inline: true },
            ],
            timestamp: new Date(weekStart),
          }),
        ],
      });
    }

    // ---------------------
    // WEEK (lecture DB)
    // ---------------------
    if (sub === 'week' && !group) {
      const rows = db
        .prepare(
          'SELECT day, user_id FROM cr_week WHERE week_start = ? ORDER BY day'
        )
        .all(weekStart) as Array<{ day: DayKey; user_id: string }>;

      const map: Record<DayKey, string[]> = {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      };
      for (const r of rows) map[r.day].push(r.user_id);

      const fields = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(
        (k) => {
          const users = map[k];
          const pretty = users.length
            ? users.map((uid) => mentionOrName(interaction, uid)).join('\n')
            : '—';
          return { name: dayLabel(k), value: pretty, inline: true };
        }
      );

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'cr',
        msg: `[CR] Récap hebdo demandé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id, weekStart },
      });

      return crEdit(interaction, {
        embeds: [
          makeEmbed({
            title: `🗓 Récap CR — semaine du ${discordAbsolute(weekStart, 'F')}`,
            timestamp: new Date(weekStart),
            fields,
          }),
        ],
      });
    }

    // ---------------------
    // TOP (lecture DB)
    // ---------------------
    if (sub === 'top' && !group) {
      const rows = db
        .prepare(
          'SELECT user_id, total FROM cr_counters ORDER BY total DESC LIMIT 10'
        )
        .all() as Array<{ user_id: string; total: number }>;

      if (!rows.length) return crEdit(interaction, 'Aucun oubli enregistré.');

      const lines = rows.map(
        (r) => `**${r.total}** — ${mentionOrName(interaction, r.user_id)}`
      );

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'cr',
        msg: `[CR] Top global demandé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id },
      });

      return crEdit(interaction, {
        embeds: [
          makeEmbed({
            title: '🏆 Top oublis global (attention à la porte)',
            description: lines.join('\n'),
          }),
        ],
      });
    }

    // ---------------------
    // RESET total
    // ---------------------
    if (group === 'reset' && sub === 'total') {
      const target = interaction.options.getUser('membre');

      if (target) {
        db.prepare('DELETE FROM cr_counters WHERE user_id = ?').run(target.id);
        return crEdit(
          interaction,
          `♻️ Compteur global remis à 0 pour ${mentionOrName(interaction, target.id)}.`
        );
      }

      // demande confirmation (inchangé)
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cr:confirm:resetTotal:yes')
          .setStyle(ButtonStyle.Danger)
          .setLabel('✅ Confirmer RESET global'),
        new ButtonBuilder()
          .setCustomId('cr:confirm:resetTotal:no')
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Annuler')
      );

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Demande de RESET global par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id },
      });

      return crEdit(interaction, {
        content:
          '⚠️ Tu es sur le point de **remettre à zéro tous les compteurs globaux**. Confirmer ?',
        components: [row],
      });
    }

    // ---------------------
    // RESET week
    // ---------------------
    if (group === 'reset' && sub === 'week') {
      db.prepare('DELETE FROM cr_week WHERE week_start = ?').run(weekStart);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Suivi hebdo réinitialisé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id, weekStart },
      });

      return crEdit(
        interaction,
        `🧹 Suivi hebdo réinitialisé (semaine du ${discordAbsolute(weekStart, 'f')}).`
      );
    }
  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /oubli-cr.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'cr',
      msg: `[CR] /oubli-cr failed for ${interaction.user.tag}`,
      meta: { officerId: interaction.user.id, error: (e as Error).message },
    });
  }
}

function memberDisplay(member: GuildMember | null | undefined, fallback: string) {
  if (member?.nickname) return `${member.nickname} (<@${member.id}>)`;
  if (member) return `<@${member.id}>`;
  return fallback;
}
function mentionOrName(i: ChatInputCommandInteraction, uid: string) {
  const m = i.guild?.members.cache.get(uid);
  return m ? `<@${uid}>` : `\`${uid}\``;
}

export default { data, execute };
