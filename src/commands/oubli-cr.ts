import { ChatInputCommandInteraction, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { readJson, writeJson } from '../utils/storage.js';
import { CR_DAYS, dayLabel } from '../utils/cr.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { currentWeekStart, isOutdated } from '../utils/week.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { discordAbsolute } from '../utils/time.js';

// Helpers
import { crDefer, crEdit } from '../utils/crReply.js';      
import { pushLog } from '../http/logs.js';

type CRCounters = Record<string, number>;
type WeekStore = {
  weekStart: string;
  days: { mon: string[]; tue: string[]; wed: string[]; thu: string[]; fri: string[]; sat: string[]; sun: string[]; };
};

const COUNTERS_PATH = 'src/data/crCounters.json';
const WEEK_PATH     = 'src/data/crWeek.json';

const OFFICER_ROLE_ID = process.env.ROLE_OFFICIERS_ID;

async function isOfficer(i: ChatInputCommandInteraction) {
  if (!i.inGuild() || !OFFICER_ROLE_ID) return false;
  const m = await i.guild!.members.fetch(i.user.id).catch(() => null);
  return !!m?.roles.cache.has(OFFICER_ROLE_ID);
}

async function loadWeek(): Promise<WeekStore> {
  const empty: WeekStore = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
  const s = await readJson<WeekStore>(WEEK_PATH, empty);
  if (isOutdated(s.weekStart)) {
    // auto-rollover si le cron n’a pas tourné
    return empty;
  }
  return s;
}
async function saveWeek(s: WeekStore) { await writeJson(WEEK_PATH, s); }

export const data = new SlashCommandBuilder()
  .setName('oubli-cr')
  .setDescription('Gestion des oublis Castle Rush')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajoute +1 oubli à un membre (officiers)')
    .addUserOption(o => o.setName('membre').setDescription('Membre concerné').setRequired(true))
    .addStringOption(o => {
      let opt = o.setName('jour').setDescription('Jour du CR').setRequired(true);
      CR_DAYS.forEach(d => opt = opt.addChoices({ name: d.label, value: d.key }));
      return opt;
    })
  )
  .addSubcommand(sc => sc
    .setName('week')
    .setDescription('Affiche le récap hebdomadaire (lun→dim)')
  )
  .addSubcommand(sc => sc
    .setName('top')
    .setDescription('Classement global des oublis (10 premiers)')
  )
  .addSubcommandGroup(g => g
    .setName('reset')
    .setDescription('Réinitialisations (officiers)')
    .addSubcommand(sc => sc
      .setName('total')
      .setDescription('Reset des compteurs globaux')
      .addUserOption(o => o.setName('membre').setDescription('Membre à remettre à 0 (ou laisser vide pour tout le monde)'))
    )
    .addSubcommand(sc => sc
      .setName('week')
      .setDescription('Reset du suivi hebdomadaire')
    )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['oubli-cr'];

  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;
  
  const sub = interaction.options.getSubcommand(true);
  const group = interaction.options.getSubcommandGroup(false);

  try {
    // Gate actions sensibles (add / reset) : si non-officier → ephemeral ONLY (pas de miroir)
    if (group === 'reset' || sub === 'add') {
      if (!(await isOfficer(interaction))) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'cr',
          msg: `[CR] Unauthorized access attempt to /oubli-cr ${group ? group + ' ' : ''}${sub} by ${interaction.user.tag}`,
          meta: { userId: interaction.user.id, officerCheck: 'failed' }
        });

        return interaction.reply({ content: '❌ Commande réservée aux **officiers**.', ephemeral: true });
      }
    }

    await crDefer(interaction);

    // Chargements
    const counters = await readJson<CRCounters>(COUNTERS_PATH, {});
    let week = await loadWeek();

    // ADD
    if (sub === 'add') {
      const user = interaction.options.getUser('membre', true);
      const jour = interaction.options.getString('jour', true) as keyof WeekStore['days'];

      counters[user.id] = (counters[user.id] ?? 0) + 1;

      const list = new Set(week.days[jour]);
      list.add(user.id); // 1 oubli max par jour/membre
      week.days[jour] = Array.from(list);

      await writeJson(COUNTERS_PATH, counters);
      await saveWeek(week);

      const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
      const name = memberDisplay(member, user.username);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Oubli ajouté par ${interaction.user.tag} pour ${name} (${dayLabel(jour)})`,
        meta: { officerId: interaction.user.id, userId: user.id, day: jour }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: '➕ Oubli CR enregistré',
          description: `**${name}** → total **${counters[user.id]}**`,
          fields: [
            { name: 'Jour', value: dayLabel(jour), inline: true },
            { name: 'Semaine', value: discordAbsolute(week.weekStart, 'F'), inline: true }
          ],
          timestamp: week.weekStart
        })]
      });
    }

    // WEEK (affichage)
    if (sub === 'week' && !group) {
      const fields = (['mon','tue','wed','thu','fri','sat','sun'] as const).map((k) => {
        const users = week.days[k];
        const pretty = users.length
          ? users.map(uid => mentionOrName(interaction, uid)).join('\n')
          : '—';
        return { name: dayLabel(k), value: pretty, inline: true };
      });

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'cr',
        msg: `[CR] Récap hebdo demandé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({
          title: `🗓 Récap CR — semaine du ${discordAbsolute(week.weekStart, 'F')}`,
          timestamp: week.weekStart,
          fields
        })]
      });
    }

    // TOP (global)
    if (sub === 'top' && !group) {
      const entries = Object.entries(counters).sort((a,b)=> b[1]-a[1]).slice(0,10);
      if (!entries.length) return crEdit(interaction, 'Aucun oubli enregistré.');
      const lines = await Promise.all(entries.map(async ([uid, n]) => {
        return `**${n}** — ${mentionOrName(interaction, uid)}`;
      }));
      
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'cr',
        msg: `[CR] Classement global des oublis demandé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id }
      });

      return crEdit(interaction, {
        embeds: [makeEmbed({ title: '🏆 Top oublis global (attention à la porte)', description: lines.join('\n') })]
      });
    }

    // RESET (groupe)
    if (group === 'reset' && sub === 'total') {
      const target = interaction.options.getUser('membre');
      
      if (target) {
        delete counters[target.id];
        await writeJson(COUNTERS_PATH, counters);
        return crEdit(interaction, `♻️ Compteur global remis à 0 pour ${mentionOrName(interaction, target.id)}.`);
      }

      // Pas de cible → demande de confirmation
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('cr:confirm:resetTotal:yes').setStyle(ButtonStyle.Danger).setLabel('✅ Confirmer RESET global'),
        new ButtonBuilder().setCustomId('cr:confirm:resetTotal:no').setStyle(ButtonStyle.Secondary).setLabel('Annuler'),
      );

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Demande de RESET global des compteurs par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id }
      });

      return crEdit(interaction, {
        content: '⚠️ Tu es sur le point de **remettre à zéro tous les compteurs globaux**. Confirmer ?',
        components: [row]
      });
    }

    if (group === 'reset' && sub === 'week') {
      week = { weekStart: currentWeekStart(), days: { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] } };
      await saveWeek(week);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'cr',
        msg: `[CR] Suivi hebdo réinitialisé par ${interaction.user.tag}`,
        meta: { officerId: interaction.user.id }
      });

      return crEdit(interaction, `🧹 Suivi hebdo réinitialisé (semaine du ${discordAbsolute(week.weekStart, 'f')}).`);
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /oubli-cr.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'cr',
      msg: `[CR] /oubli-cr failed for ${interaction.user.tag}`,
      meta: { officerId: interaction.user.id, error: (e as Error).message }
    });
    return;
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
