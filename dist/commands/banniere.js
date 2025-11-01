import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);
dayjs.extend(tz);
import { makeEmbed } from '../utils/formatting/embed.js';
import { safeError } from '../utils/discord/reply.js';
import { CHANNEL_IDS, COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { discordAbsolute } from '../utils/time/time.js';
import { officerDefer, officerEdit } from '../utils/formatting/officerReply.js';
import { MIRROR_PING_ALLOWLIST, MIRROR_PING_BLOCKLIST, cmdKey } from '../config/mirror.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('cmd:banniere');
import { sendToChannel } from '../utils/discord/send.js';
import { pushLog } from '../http/logs.js';
import { parseDate, getDateSuggestions } from '../utils/time/dateParser.js';
// ⬇️ DB
import { insertBanner, listUpcomingBanners, listAllBanners, getNextBanner, removeBannerById, getBannerById, updateBanner } from '../db/banners.js';
const TZ = process.env.RESET_CRON_TZ || 'Europe/Paris';
function newId() {
    const stamp = dayjs().format('YYYYMMDD_HHmmss');
    const rnd = Math.random().toString(36).slice(2, 6);
    return `bn_${stamp}_${rnd}`;
}
function parseLocal(dateStr, timeStr) {
    const d = dayjs.tz(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', TZ);
    return d.isValid() ? d : null;
}
function fmtRangeIso(startIso, endIso) {
    return `${discordAbsolute(startIso, 'F')} → ${discordAbsolute(endIso, 'F')}`;
}
export const data = new SlashCommandBuilder()
    .setName('banniere')
    .setDescription('Gestion des bannières (officiers)')
    .setDMPermission(false)
    .addSubcommand(sc => sc
    .setName('add')
    .setDescription('Ajouter une bannière')
    .addStringOption(o => o.setName('nom').setDescription('Nom de la bannière').setRequired(true))
    .addStringOption(o => o
    .setName('debut_date')
    .setDescription('Date de début (ex: "demain", "lundi", "15/11/2025")')
    .setRequired(true)
    .setAutocomplete(true))
    .addStringOption(o => o.setName('debut_heure').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption(o => o
    .setName('fin_date')
    .setDescription('Date de fin (ex: "vendredi", "dans 5 jours", "20/11/2025")')
    .setRequired(true)
    .setAutocomplete(true))
    .addStringOption(o => o.setName('fin_heure').setDescription('HH:MM (24h)').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note (optionnel)'))
    .addStringOption(o => o.setName('image').setDescription('URL image (optionnel)')))
    .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Lister toutes les bannières à venir (triées)'))
    .addSubcommand(sc => sc
    .setName('next')
    .setDescription('Afficher la prochaine bannière'))
    .addSubcommand(sc => sc
    .setName('remove')
    .setDescription('Supprimer une bannière par ID')
    .addStringOption(o => o
    .setName('id')
    .setDescription('ID de la bannière')
    .setRequired(true)
    .setAutocomplete(true)))
    .addSubcommand(sc => sc
    .setName('edit')
    .setDescription('Modifier une bannière par ID')
    .addStringOption(o => o
    .setName('id')
    .setDescription('ID')
    .setRequired(true)
    .setAutocomplete(true))
    .addStringOption(o => o.setName('nom').setDescription('Nouveau nom'))
    .addStringOption(o => o
    .setName('debut_date')
    .setDescription('Nouvelle date de début (ex: "demain", "15/11/2025")')
    .setAutocomplete(true))
    .addStringOption(o => o.setName('debut_heure').setDescription('HH:MM'))
    .addStringOption(o => o
    .setName('fin_date')
    .setDescription('Nouvelle date de fin (ex: "vendredi", "20/11/2025")')
    .setAutocomplete(true))
    .addStringOption(o => o.setName('fin_heure').setDescription('HH:MM'))
    .addStringOption(o => o.setName('note').setDescription('Nouvelle note'))
    .addStringOption(o => o.setName('image').setDescription('Nouvelle URL image')));
export async function execute(interaction) {
    const rule = COMMAND_RULES['banniere'];
    if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] })))
        return;
    const sub = interaction.options.getSubcommand(true);
    const FORCE_PUBLIC = sub === 'list' || sub === 'next' || sub === 'remove' || sub === 'edit' || sub === 'add';
    try {
        if (FORCE_PUBLIC) {
            await interaction.deferReply({ ephemeral: false });
        }
        else {
            await officerDefer(interaction);
        }
        const nowIso = dayjs().toISOString();
        if (sub === 'add') {
            const name = interaction.options.getString('nom', true);
            const sdInput = interaction.options.getString('debut_date', true);
            const sh = interaction.options.getString('debut_heure', true);
            const edInput = interaction.options.getString('fin_date', true);
            const eh = interaction.options.getString('fin_heure', true);
            const note = interaction.options.getString('note') ?? undefined;
            const image = interaction.options.getString('image') ?? undefined;
            // Parser les dates avec le nouveau système
            const sd = parseDate(sdInput);
            const ed = parseDate(edInput);
            if (!sd)
                return officerEdit(interaction, `❌ Date de début invalide : "${sdInput}"\n💡 Formats acceptés : "demain", "lundi", "15/11/2025", "15 novembre", etc.`);
            if (!ed)
                return officerEdit(interaction, `❌ Date de fin invalide : "${edInput}"\n💡 Formats acceptés : "vendredi", "dans 5 jours", "20/11/2025", etc.`);
            const start = parseLocal(sd, sh);
            const end = parseLocal(ed, eh);
            if (!start || !end)
                return officerEdit(interaction, '❌ Heures invalides (format: `HH:MM`).');
            if (!end.isAfter(start))
                return officerEdit(interaction, '❌ La date de fin doit être **après** la date de début.');
            const b = {
                id: newId(),
                name,
                start_iso: start.toISOString(),
                end_iso: end.toISOString(),
                note: note ?? null,
                image: image ?? null,
                added_by: interaction.user.id,
            };
            insertBanner(b);
            pushLog({
                ts: new Date().toISOString(),
                level: 'action',
                component: 'banniere',
                msg: `Nouvelle bannière ajoutée : ${b.name}`,
                meta: { id: b.id, addedBy: interaction.user.id, start: b.start_iso, end: b.end_iso }
            });
            const emb = makeEmbed({
                title: '🧾 Bannière ajoutée',
                description: `**${b.name}**\n${fmtRangeIso(b.start_iso, b.end_iso)}`,
                footer: `ID: ${b.id}`,
                timestamp: new Date(),
            });
            if (b.image)
                emb.setImage(b.image);
            if (b.note)
                emb.addFields({ name: 'Note', value: b.note });
            return officerEdit(interaction, { embeds: [emb] });
        }
        if (sub === 'list') {
            const upcoming = listUpcomingBanners(nowIso);
            if (!upcoming.length)
                return officerEdit(interaction, { content: 'Aucune bannière à venir.', flags: undefined });
            const lines = upcoming
                .map(b => `• **${b.name}** — ${fmtRangeIso(b.start_iso, b.end_iso)} — \`${b.id}\``)
                .join('\n');
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
            const b = getNextBanner(nowIso);
            if (!b)
                return officerEdit(interaction, 'Aucune bannière à venir.');
            pushLog({
                ts: new Date().toISOString(),
                level: 'info',
                component: 'banniere',
                msg: `Prochaine bannière affichée : ${b.name}`,
                meta: { id: b.id, requestedBy: interaction.user.id }
            });
            const emb = makeEmbed({
                title: '⏭️ Prochaine bannière',
                description: `**${b.name}**\n${fmtRangeIso(b.start_iso, b.end_iso)}`,
                footer: `ID: ${b.id}`,
                timestamp: new Date(),
            });
            if (b.image)
                emb.setImage(b.image);
            if (b.note)
                emb.addFields({ name: 'Note', value: b.note });
            return officerEdit(interaction, { embeds: [emb] });
        }
        if (sub === 'remove') {
            const id = interaction.options.getString('id', true);
            const ok = removeBannerById(id);
            if (!ok) {
                pushLog({
                    ts: new Date().toISOString(),
                    level: 'warn',
                    component: 'banniere',
                    msg: `Échec suppression bannière (ID introuvable) : ${id}`,
                    meta: { attemptedBy: interaction.user.id }
                });
                return officerEdit(interaction, '❌ ID introuvable.');
            }
            pushLog({
                ts: new Date().toISOString(),
                level: 'warn',
                component: 'banniere',
                msg: `Bannière supprimée`,
                meta: { id, removedBy: interaction.user.id }
            });
            return officerEdit(interaction, `🗑️ Bannière supprimée (\`${id}\`).`);
        }
        if (sub === 'edit') {
            const id = interaction.options.getString('id', true);
            const b = getBannerById(id);
            if (!b)
                return officerEdit(interaction, '❌ ID introuvable.');
            const nm = interaction.options.getString('nom') ?? undefined;
            const sDInput = interaction.options.getString('debut_date') ?? undefined;
            const sH = interaction.options.getString('debut_heure') ?? undefined;
            const eDInput = interaction.options.getString('fin_date') ?? undefined;
            const eH = interaction.options.getString('fin_heure') ?? undefined;
            const note = interaction.options.getString('note') ?? undefined;
            const image = interaction.options.getString('image') ?? undefined;
            if ((sDInput && !sH) || (!sDInput && sH) || (eDInput && !eH) || (!eDInput && eH)) {
                pushLog({
                    ts: new Date().toISOString(),
                    level: 'warn',
                    component: 'banniere',
                    msg: `Échec modification bannière (date/heure incomplète) : ${b.name}`,
                    meta: { id: b.id, editedBy: interaction.user.id }
                });
                return officerEdit(interaction, '❌ Pour modifier une date, fournis **date + heure** (début et/ou fin).');
            }
            let startIso = b.start_iso;
            let endIso = b.end_iso;
            if (sDInput && sH) {
                const sD = parseDate(sDInput);
                if (!sD)
                    return officerEdit(interaction, `❌ Date de début invalide : "${sDInput}"\n💡 Formats acceptés : "demain", "lundi", "15/11/2025", etc.`);
                const s = parseLocal(sD, sH);
                if (!s)
                    return officerEdit(interaction, '❌ Heure de début invalide.');
                startIso = s.toISOString();
            }
            if (eDInput && eH) {
                const eD = parseDate(eDInput);
                if (!eD)
                    return officerEdit(interaction, `❌ Date de fin invalide : "${eDInput}"\n💡 Formats acceptés : "vendredi", "20/11/2025", etc.`);
                const e = parseLocal(eD, eH);
                if (!e)
                    return officerEdit(interaction, '❌ Heure de fin invalide.');
                endIso = e.toISOString();
            }
            if (dayjs(endIso).isBefore(dayjs(startIso))) {
                pushLog({
                    ts: new Date().toISOString(),
                    level: 'warn',
                    component: 'banniere',
                    msg: `Échec modification bannière (fin avant début) : ${b.name}`,
                    meta: { id: b.id, editedBy: interaction.user.id }
                });
                return officerEdit(interaction, '❌ La fin doit être après le début.');
            }
            updateBanner({
                id,
                name: nm ?? b.name,
                start_iso: startIso,
                end_iso: endIso,
                note: note !== undefined ? note : b.note,
                image: image !== undefined ? image : b.image,
            });
            const updated = getBannerById(id);
            pushLog({
                ts: new Date().toISOString(),
                level: 'info',
                component: 'banniere',
                msg: `Bannière modifiée : ${updated.name}`,
                meta: { id: updated.id, editedBy: interaction.user.id }
            });
            const emb = makeEmbed({
                title: '✏️ Bannière modifiée',
                description: `**${updated.name}**\n${fmtRangeIso(updated.start_iso, updated.end_iso)}`,
                footer: `ID: ${updated.id}`,
            });
            if (updated.image)
                emb.setImage(updated.image);
            if (updated.note)
                emb.addFields({ name: 'Note', value: updated.note });
            return officerEdit(interaction, { embeds: [emb] });
        }
        // Mirroring “trace” (inchangé)
        try {
            const key = cmdKey('banniere', sub);
            if (!MIRROR_PING_BLOCKLIST.has(key) && !MIRROR_PING_BLOCKLIST.has('banniere')) {
                const mention = (MIRROR_PING_ALLOWLIST.has(key) || MIRROR_PING_ALLOWLIST.has('banniere'))
                    ? (ROLE_IDS.OFFICIERS ? `<@&${ROLE_IDS.OFFICIERS}> ` : '')
                    : '';
                const header = `${mention}🧾 **Trace /banniere ${sub}** — par <@${interaction.user.id}> depuis <#${interaction.channelId}>`;
                const embed = makeEmbed({
                    title: '🧾 Commande /banniere exécutée',
                    fields: [
                        { name: 'Sous-commande', value: sub, inline: true },
                        { name: 'Utilisateur', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Canal', value: `<#${interaction.channelId}>`, inline: true },
                    ],
                    timestamp: new Date(),
                });
                await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, { content: header, embeds: [embed] });
            }
        }
        catch (mirrorError) {
            log.error({ error: mirrorError, userId: interaction.user.id }, 'Erreur mirroring bannière');
            pushLog({
                ts: new Date().toISOString(),
                level: 'error',
                component: 'banniere',
                msg: `Erreur de mirroring /banniere pour <@${interaction.user.id}>`,
                meta: { error: mirrorError.message }
            });
        }
    }
    catch (e) {
        log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /banniere');
        await safeError(interaction, 'Erreur sur /banniere.');
        pushLog({
            ts: new Date().toISOString(),
            level: 'error',
            component: 'banniere',
            msg: `Erreur sur /banniere pour <@${interaction.user.id}>`,
            meta: { error: e.message }
        });
    }
}
export async function autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    // Autocomplete pour les dates
    if (focused.name === 'debut_date' || focused.name === 'fin_date') {
        const suggestions = getDateSuggestions(focused.value);
        return interaction.respond(suggestions);
    }
    // Autocomplete pour les IDs (remove/edit)
    if (focused.name === 'id') {
        const allBanners = listAllBanners();
        const filtered = allBanners
            .filter(b => b.id.toLowerCase().includes(focused.value.toLowerCase()) ||
            b.name.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(b => ({
            name: `${b.name} (${b.id})`,
            value: b.id
        }));
        return interaction.respond(filtered);
    }
    return interaction.respond([]);
}
export default { data, execute, autocomplete };
