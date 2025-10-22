import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);

import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { readJson, writeJson } from '../utils/storage.js';
import { CHANNEL_IDS, COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { discordAbsolute } from '../utils/time.js';
import { officerDefer, officerEdit, officerReply } from '../utils/officerReply.js';
import { MIRROR_PING_ALLOWLIST, MIRROR_PING_BLOCKLIST, cmdKey } from '../config/mirror.js';
import { sendToChannel } from '../utils/send.js';
import { pushLog } from '../http/logs.js';

const STORE = 'src/data/banners.json';
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';

type Banner = {
  id: string;
  name: string;
  start: string; // ISO
  end: string;   // ISO
  note?: string;
  image?: string;
  addedBy: string;
};

function newId() {
  const stamp = dayjs().format('YYYYMMDD_HHmmss');
  const rnd = Math.random().toString(36).slice(2, 6);
  return `bn_${stamp}_${rnd}`;
}

function parseLocal(dateStr: string, timeStr: string) {
  const d = dayjs.tz(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', TZ);
  return d.isValid() ? d : null;
}

function fmtRange(b: Banner) {
  return `${discordAbsolute(b.start, 'F')} → ${discordAbsolute(b.end, 'F')}`;
}

export const data = new SlashCommandBuilder()
  .setName('banniere')
  .setDescription('Gestion des bannières (officiers)')
  .setDMPermission(false)
  .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajouter une bannière')
    .addStringOption(o => o.setName('nom').setDescription('Nom de la bannière').setRequired(true))
    .addStringOption(o => o.setName('debut_date').setDescription('YYYY-MM-DD').setRequired(true))
    .addStringOption(o => o.setName('debut_heure').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption(o => o.setName('fin_date').setDescription('YYYY-MM-DD').setRequired(true))
    .addStringOption(o => o.setName('fin_heure').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note (optionnel)'))
    .addStringOption(o => o.setName('image').setDescription('URL image (optionnel)'))
  )
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister toutes les bannières à venir (triées)')
  )
  .addSubcommand(sc => sc
    .setName('next')
    .setDescription('Afficher la prochaine bannière')
  )
  .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprimer une bannière par ID')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID de la bannière')
      .setRequired(true)
      .setAutocomplete(true)
    )
  )
  .addSubcommand(sc => sc
    .setName('edit')
    .setDescription('Modifier une bannière par ID')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID')
      .setRequired(true)
      .setAutocomplete(true)
    )
    .addStringOption(o => o.setName('nom').setDescription('Nouveau nom'))
    .addStringOption(o => o.setName('debut_date').setDescription('YYYY-MM-DD'))
    .addStringOption(o => o.setName('debut_heure').setDescription('HH:MM'))
    .addStringOption(o => o.setName('fin_date').setDescription('YYYY-MM-DD'))
    .addStringOption(o => o.setName('fin_heure').setDescription('HH:MM'))
    .addStringOption(o => o.setName('note').setDescription('Nouvelle note'))
    .addStringOption(o => o.setName('image').setDescription('Nouvelle URL image'))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['banniere'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return; // 🔄 on ignore les channels ici

  const sub = interaction.options.getSubcommand(true);
  const FORCE_PUBLIC = sub === 'list' || sub === 'next' || sub === 'remove' || sub === 'edit' || sub === 'add';

  try {
    if (FORCE_PUBLIC) {
      await interaction.deferReply({ ephemeral: false }); // public
    } else {
      await officerDefer(interaction);                    // smart ephemeral + miroir
    }
    let list = await readJson<Banner[]>(STORE, []);
    const now = dayjs().tz(TZ);

    if (sub === 'add') {
      const name = interaction.options.getString('nom', true);
      const sd = interaction.options.getString('debut_date', true);
      const sh = interaction.options.getString('debut_heure', true);
      const ed = interaction.options.getString('fin_date', true);
      const eh = interaction.options.getString('fin_heure', true);
      const note = interaction.options.getString('note') ?? undefined;
      const image = interaction.options.getString('image') ?? undefined;

      const start = parseLocal(sd, sh);
      const end = parseLocal(ed, eh);
      if (!start || !end)
        return officerEdit(interaction, '❌ Dates/heures invalides (formats: `YYYY-MM-DD` et `HH:MM`).');
      if (!end.isAfter(start))
        return officerEdit(interaction, '❌ La date de fin doit être **après** la date de début.');

      const b: Banner = {
        id: newId(),
        name,
        start: start.toISOString(),
        end: end.toISOString(),
        note, image,
        addedBy: interaction.user.id,
      };
      list.push(b);
      list.sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
      await writeJson(STORE, list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'action',
        component: 'banniere',
        msg: `Nouvelle bannière ajoutée : ${b.name}`,
        meta: { id: b.id, addedBy: interaction.user.id, start: b.start, end: b.end }
      });

      const emb = makeEmbed({
        title: '🧾 Bannière ajoutée',
        description: `**${b.name}**\n${fmtRange(b)}`,
        footer: `ID: ${b.id}`,
        timestamp: new Date(),
      });
      if (b.image) emb.setImage(b.image);
      if (b.note) emb.addFields({ name: 'Note', value: b.note });

      return officerEdit(interaction, { embeds: [emb] });
    }

    if (sub === 'list') {
      const upcoming = list.filter(b => dayjs(b.end).isAfter(now));
      if (!upcoming.length) {
        return officerEdit(interaction, { content: 'Aucune bannière à venir.', flags: undefined });
      }
      const lines = upcoming.map(b => `• **${b.name}** — ${fmtRange(b)} — \`${b.id}\``).join('\n');

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'banniere',
        msg: `Liste des bannières à venir affichée`,
        meta: { count: upcoming.length, requestedBy: interaction.user.id }
      });

      return officerEdit(interaction, {
        embeds: [makeEmbed({ title: '📜 Bannières à venir', description: lines })],
      });
    }

    if (sub === 'next') {
      const upcoming = list.filter(b => dayjs(b.end).isAfter(now))
        .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
      if (!upcoming.length)
        return officerEdit(interaction, 'Aucune bannière à venir.');
      const b = upcoming[0];
      
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'banniere',
        msg: `Prochaine bannière affichée : ${b.name}`,
        meta: { id: b.id, requestedBy: interaction.user.id }
      });

      const emb = makeEmbed({
        title: '⏭️ Prochaine bannière',
        description: `**${b.name}**\n${fmtRange(b)}`,
        footer: `ID: ${b.id}`,
        timestamp: new Date(),
      });
      if (b.image) emb.setImage(b.image);
      if (b.note) emb.addFields({ name: 'Note', value: b.note });
      return officerEdit(interaction, { embeds: [emb] });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      const idx = list.findIndex(b => b.id === id);
      if (idx === -1) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'banniere',
          msg: `Échec suppression bannière (ID introuvable) : ${id}`,
          meta: { attemptedBy: interaction.user.id }
        });

        return officerEdit(interaction, '❌ ID introuvable.');
      }
        
      const [rm] = list.splice(idx, 1);
      await writeJson(STORE, list);
      
      pushLog({
        ts: new Date().toISOString(),
        level: 'warn',
        component: 'banniere',
        msg: `Bannière supprimée : ${rm.name}`,
        meta: { id: rm.id, removedBy: interaction.user.id }
      });

      return officerEdit(interaction, `🗑️ Bannière **${rm.name}** supprimée (\`${rm.id}\`).`);
    }

    if (sub === 'edit') {
      const id = interaction.options.getString('id', true);
      const b = list.find(x => x.id === id);
      if (!b) return officerEdit(interaction, '❌ ID introuvable.');

      const nm = interaction.options.getString('nom') ?? undefined;
      const sD = interaction.options.getString('debut_date') ?? undefined;
      const sH = interaction.options.getString('debut_heure') ?? undefined;
      const eD = interaction.options.getString('fin_date') ?? undefined;
      const eH = interaction.options.getString('fin_heure') ?? undefined;
      const note = interaction.options.getString('note') ?? undefined;
      const image = interaction.options.getString('image') ?? undefined;

      if (nm) b.name = nm;
      if ((sD && !sH) || (!sD && sH) || (eD && !eH) || (!eD && eH)) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'banniere',
          msg: `Échec modification bannière (date/heure incomplète) : ${b.name}`,
          meta: { id: b.id, editedBy: interaction.user.id }
        });

        return officerEdit(interaction, '❌ Pour modifier une date, fournis **date + heure** (début et/ou fin).');
      }
        
      if (sD && sH) {
        const s = parseLocal(sD, sH);
        if (!s) {
          pushLog({
            ts: new Date().toISOString(),
            level: 'warn',
            component: 'banniere',
            msg: `Échec modification bannière (début invalide) : ${b.name}`,
            meta: { id: b.id, editedBy: interaction.user.id }
          });

          return officerEdit(interaction, '❌ Début invalide.');
        }
        b.start = s.toISOString();
      }
      if (eD && eH) {
        const e = parseLocal(eD, eH);
        if (!e) {
          pushLog({
            ts: new Date().toISOString(),
            level: 'warn',
            component: 'banniere',
            msg: `Échec modification bannière (fin invalide) : ${b.name}`,
            meta: { id: b.id, editedBy: interaction.user.id }
          });

          return officerEdit(interaction, '❌ Fin invalide.');
        } 
        b.end = e.toISOString();
      }
      if (dayjs(b.end).isBefore(dayjs(b.start))) {
        pushLog({
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'banniere',
          msg: `Échec modification bannière (fin avant début) : ${b.name}`,
          meta: { id: b.id, editedBy: interaction.user.id }
        });

        return officerEdit(interaction, '❌ La fin doit être après le début.');
      }
      if (note !== undefined) b.note = note;
      if (image !== undefined) b.image = image;

      await writeJson(STORE, list);

      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'banniere',
        msg: `Bannière modifiée : ${b.name}`,
        meta: { id: b.id, editedBy: interaction.user.id }
      });

      const emb = makeEmbed({
        title: '✏️ Bannière modifiée',
        description: `**${b.name}**\n${fmtRange(b)}`,
        footer: `ID: ${b.id}`,
      });
      if (b.image) emb.setImage(b.image);
      if (b.note) emb.addFields({ name: 'Note', value: b.note });
      return officerEdit(interaction, { embeds: [emb] });
    }

    try {
      const subCmd = sub;
      const key = cmdKey('banniere', subCmd);

      // Skip si blocklist
      if (!MIRROR_PING_BLOCKLIST.has(key) && !MIRROR_PING_BLOCKLIST.has('banniere')) {
        const mention = (MIRROR_PING_ALLOWLIST.has(key) || MIRROR_PING_ALLOWLIST.has('banniere'))
          ? (ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}> ` : '')
          : '';

        const header = `${mention}🧾 **Trace /banniere ${subCmd}** — par <@${interaction.user.id}> depuis <#${interaction.channelId}>`;

        const embed = makeEmbed({
          title: '🧾 Commande /banniere exécutée',
          fields: [
            { name: 'Sous-commande', value: subCmd, inline: true },
            { name: 'Utilisateur', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Canal', value: `<#${interaction.channelId}>`, inline: true },
          ],
          timestamp: new Date(),
        });

        await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, {
          content: header,
          embeds: [embed],
        });
      }
    } catch (mirrorError) {
      console.error('[MIRROR_BANNIERE] erreur mirror', mirrorError);
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'banniere',
        msg: `Erreur de mirroring /banniere pour <@${interaction.user.id}>`,
        meta: { error: (mirrorError as Error).message }
      });
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /banniere.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'banniere',
      msg: `Erreur sur /banniere pour <@${interaction.user.id}>`,
      meta: { error: (e as Error).message }
    });
  }
}

export default { data, execute };
