import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Colors, EmbedBuilder } from 'discord.js';
import { COMMAND_RULES, ROLE_IDS } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js';
import { sendToChannel } from '../utils/send.js';
import { CHANNEL_IDS } from '../config/permissions.js';
import { discordAbsolute } from '../utils/time.js';
import { pushLog } from '../http/logs.js';

// DB
import {
  countOpenCandidatures,
  listOpenCandidaturesPaged,
  setCandidatureStatus,
  getCandidatureById,
} from '../db/candidatures.js';

const PAGE_SIZE = 5;

export const data = new SlashCommandBuilder()
  .setName('candidatures')
  .setDescription('Gestion des candidatures (officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Afficher la liste des candidatures ouvertes')
    .addIntegerOption(o => o.setName('page').setDescription('Page (défaut: 1)').setMinValue(1))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rule = COMMAND_RULES['candidatures'];
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: [] }))) return;

  const sub = interaction.options.getSubcommand(true);
  if (sub !== 'list') return;

  try {
    await officerDefer(interaction);

    const page = interaction.options.getInteger('page') ?? 1;
    const total = countOpenCandidatures();
    if (!total) {
      return officerEdit(interaction, 'Aucune candidature ouverte.');
    }

    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const cur = Math.min(Math.max(1, page), maxPage);
    const offset = (cur - 1) * PAGE_SIZE;
    const slice = listOpenCandidaturesPaged(PAGE_SIZE, offset);

    const emb = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`📋 Candidatures ouvertes — ${total} en attente`)
      .setFooter({ text: `Page ${cur}/${maxPage}` })
      .setTimestamp();

    emb.setDescription(
      slice.map(c => {
        const when = discordAbsolute(c.created_at, 'f');
        const link = c.message_url ? ` — [lien](${c.message_url})` : '';
        return `• **#${c.id}** — <@${c.user_id}> — ${when}${link}`;
      }).join('\n')
    );

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Pagination
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`cand:page:${cur - 1}`).setStyle(ButtonStyle.Secondary).setLabel('⬅️ Précédent').setDisabled(cur <= 1),
      new ButtonBuilder().setCustomId(`cand:page:${cur + 1}`).setStyle(ButtonStyle.Secondary).setLabel('Suivant ➡️').setDisabled(cur >= maxPage),
    ));

    // Actions (accept / reject)
    for (const c of slice) {
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`cand:accept:${c.id}`).setStyle(ButtonStyle.Success).setLabel(`Accepter #${c.id}`),
        new ButtonBuilder().setCustomId(`cand:reject:${c.id}`).setStyle(ButtonStyle.Danger).setLabel(`Refuser #${c.id}`),
      ));
    }

    await officerEdit(interaction, { embeds: [emb], components: rows });

    pushLog({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'candidatures',
      msg: `Liste des candidatures consultée par <@${interaction.user.id}>`,
      meta: { page: cur, pageSize: PAGE_SIZE, total }
    });

  } catch (e) {
    console.error(e);
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'candidatures',
      msg: `Erreur sur /candidatures list pour <@${interaction.user.id}>`,
      meta: { error: (e as Error).message }
    });
    await safeError(interaction, 'Erreur sur /candidatures list.');
  }
}

// ---------- Buttons handler ----------
export async function handleCandidaturesButton(interaction: ButtonInteraction) {
  try {
    // officers-only
    const isOfficer = interaction.member && 'roles' in interaction.member
      ? (interaction as any).member?.roles?.cache?.has?.(ROLE_IDS.OFFICIERS)
      : false;
    if (!isOfficer) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'warn',
        component: 'candidatures',
        msg: `Tentative d'utilisation bouton candidatures par <@${interaction.user.id}> sans accès`,
        meta: {}
      });
      return interaction.reply({ content: '❌ Réservé aux officiers.', ephemeral: true });
    }

    const [kind, action, arg] = interaction.customId.split(':'); // cand:accept:<id> | cand:reject:<id> | cand:page:<n>
    if (kind !== 'cand') return;

    if (action === 'page') {
      const fakeSlash = {
        ...interaction,
        options: { getSubcommand: () => 'list', getInteger: () => Number(arg) },
        // on réutilise la même logique d’affichage
      } as any as ChatInputCommandInteraction;
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'candidatures',
        msg: `Navigation candidatures page ${arg} par <@${interaction.user.id}>`,
        meta: {}
      });
      return execute(fakeSlash);
    }

    if (action === 'accept' || action === 'reject') {
      const id = arg; // TEXT PK
      const entry = getCandidatureById(id);
      if (!entry || entry.status !== 'open') {
        pushLog({ 
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'candidatures',
          msg: `Candidature #${id} introuvable/fermée pour ${action} par <@${interaction.user.id}>`,
          meta: {}
        });
        return interaction.reply({ content: `❌ Candidature #${id} introuvable (ou déjà traitée).`, ephemeral: true });
      }

      setCandidatureStatus(id, action === 'accept' ? 'accepted' : 'rejected');

      // roleswap si accept
      let extraNote = '';
      if (action === 'accept') {
        try {
          const guild = await interaction.client.guilds.fetch(entry.channel_id.split('/')[0]).catch(()=>null);
          const targetGuild = guild ?? (await interaction.client.guilds.fetch(process.env.GUILD_ID!).catch(()=>null));
          if (targetGuild) {
            const member = await targetGuild.members.fetch(entry.user_id).catch(() => null);
            if (member) {
              const me = targetGuild.members.me;
              const canManage =
                me?.permissions.has('ManageRoles') &&
                (!ROLE_IDS.RECRUES || me.roles.highest.comparePositionTo(targetGuild.roles.cache.get(ROLE_IDS.RECRUES)!) > 0) &&
                (!ROLE_IDS.MEMBRES || me.roles.highest.comparePositionTo(targetGuild.roles.cache.get(ROLE_IDS.MEMBRES)!) > 0);
              if (canManage) {
                if (ROLE_IDS.MEMBRES && !member.roles.cache.has(ROLE_IDS.MEMBRES)) {
                  await member.roles.add(ROLE_IDS.MEMBRES, `candidature acceptée (#${id})`);
                }
                if (ROLE_IDS.RECRUES && member.roles.cache.has(ROLE_IDS.RECRUES)) {
                  await member.roles.remove(ROLE_IDS.RECRUES, `candidature acceptée (#${id})`);
                }
                extraNote = ' — ✅ roleswap effectué.';
              } else {
                extraNote = ' — ⚠️ perms/hiérarchie rôles insuffisantes.';
              }
            } else {
              extraNote = ' — ⚠️ membre introuvable (a quitté ?).';
            }
          }
        } catch { /* ignore */ }
      }

      // log public
      await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, {
        content: `**${action === 'accept' ? '✅ Acceptée' : '❌ Refusée'}** par <@${interaction.user.id}> — candidature **#${id}** de <@${entry.user_id}> — ${entry.message_url ? `[lien](${entry.message_url})` : '(pas de lien)'}${extraNote}`,
      });

      // DM best-effort
      try {
        const user = await interaction.client.users.fetch(entry.user_id);
        if (action === 'accept') {
          await user.send(`🎉 Ta candidature (**#${id}**) a été **acceptée** ! Bienvenue !`);
        } else {
          await user.send(`👋 Ta candidature (**#${id}**) a été **refusée**. Merci pour l’intérêt porté à la guilde.`);
        }
      } catch {}

      await interaction.reply({ content: `${action === 'accept' ? '✅ Acceptée' : '❌ Refusée'} (#${id}).`, ephemeral: true });

      // rafraichir la page courante via footer Page X/Y si dispo
      const footerText = interaction.message.embeds[0]?.footer?.text ?? '';
      const m = footerText.match(/Page\s+(\d+)\/(\d+)/);
      const curPage = m ? Number(m[1]) : 1;

      const fakeSlash = {
        ...interaction,
        options: { getSubcommand: () => 'list', getInteger: () => curPage },
        editReply: interaction.update.bind(interaction),
      } as any as ChatInputCommandInteraction;

      return execute(fakeSlash);
    }

  } catch (e) {
    console.error('[candidatures button] error:', e);
    if (!interaction.deferred && !interaction.replied) {
      pushLog({
        ts: new Date().toISOString(),
        level: 'error',
        component: 'candidatures',
        msg: `Erreur bouton candidatures pour <@${interaction.user.id}>`,
        meta: { error: (e as Error).message }
      });
      await interaction.reply({ content: 'Erreur bouton.', ephemeral: true });
    }
  }
}

export default { data, execute };
