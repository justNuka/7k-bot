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

const PAGE_SIZE = 5; // Nombre de candidatures par page

/**
 * Génère un ID lisible à partir d'un message ID Discord
 * Ex: 1433764806569234494 -> C-494
 */
function shortId(fullId: string): string {
  // Prendre les 3 derniers chiffres pour un ID court
  return `C-${fullId.slice(-3)}`;
}

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
    // Message public au lieu d'éphémère
    await interaction.deferReply({ ephemeral: false });

    const page = interaction.options.getInteger('page') ?? 1;
    const total = countOpenCandidatures();
    if (!total) {
      return interaction.editReply('Aucune candidature ouverte.');
    }

    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const cur = Math.min(Math.max(1, page), maxPage);
    const offset = (cur - 1) * PAGE_SIZE;
    const slice = listOpenCandidaturesPaged(PAGE_SIZE, offset);

    // Construction de l'embed avec toutes les candidatures de la page
    const emb = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`📋 Candidatures ouvertes`)
      .setDescription(`**${total}** candidature${total > 1 ? 's' : ''} en attente`)
      .setFooter({ text: `Page ${cur}/${maxPage}` })
      .setTimestamp();

    // Afficher chaque candidature comme un field
    for (const c of slice) {
      // const sid = shortId(c.id);
      const id = c.id;
      const when = discordAbsolute(c.created_at, 'f'); // date courte
      const link = c.message_url ? ` · [📄 Voir](${c.message_url})` : '';
      const attachIcon = c.has_attachments ? ' 📎' : '';
      
      emb.addFields({
        name: `${id}${attachIcon}`,
        value: `<@${c.user_id}> · ${when}${link}`,
        inline: false
      });
    }

    // Boutons : une rangée pour chaque candidature (Accepter / Refuser)
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (const c of slice) {
      const sid = shortId(c.id);
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cand:accept:${c.id}`)
          .setStyle(ButtonStyle.Success)
          .setLabel(`✅ ${sid}`),
        new ButtonBuilder()
          .setCustomId(`cand:reject:${c.id}`)
          .setStyle(ButtonStyle.Danger)
          .setLabel(`❌ ${sid}`),
      ));
    }

    // Pagination en bas
    if (maxPage > 1) {
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cand:page:${cur - 1}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('⬅️ Page précédente')
          .setDisabled(cur <= 1),
        new ButtonBuilder()
          .setCustomId(`cand:page:${cur + 1}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Page suivante ➡️')
          .setDisabled(cur >= maxPage),
      ));
    }

    await interaction.editReply({ embeds: [emb], components: rows });

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
        options: { 
          getSubcommand: () => 'list', 
          getInteger: () => Number(arg) 
        },
        inGuild: () => interaction.inGuild(),
        isChatInputCommand: () => true,
        deferReply: interaction.deferUpdate.bind(interaction),
        editReply: interaction.editReply.bind(interaction),
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
      const id = arg; // TEXT PK (full message ID)
      // const sid = shortId(id); // Short ID pour affichage
      const entry = getCandidatureById(id);
      if (!entry || entry.status !== 'open') {
        pushLog({ 
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'candidatures',
          msg: `Candidature ${id} introuvable/fermée pour ${action} par <@${interaction.user.id}>`,
          meta: {}
        });
        return interaction.reply({ content: `❌ Candidature ${id} introuvable (ou déjà traitée).`, ephemeral: true });
      }

      setCandidatureStatus(id, action === 'accept' ? 'accepted' : 'rejected');

      // roleswap selon acceptation ou refus
      let extraNote = '';
      try {
        const guild = await interaction.client.guilds.fetch(entry.channel_id.split('/')[0]).catch(()=>null);
        const targetGuild = guild ?? (await interaction.client.guilds.fetch(process.env.GUILD_ID!).catch(()=>null));
        if (targetGuild) {
          const member = await targetGuild.members.fetch(entry.user_id).catch(() => null);
          if (member) {
            const me = targetGuild.members.me;
            const recruesRole = ROLE_IDS.RECRUES ? targetGuild.roles.cache.get(ROLE_IDS.RECRUES) : null;
            const membresRole = ROLE_IDS.MEMBRES ? targetGuild.roles.cache.get(ROLE_IDS.MEMBRES) : null;
            const visiteursRole = ROLE_IDS.VISITEURS ? targetGuild.roles.cache.get(ROLE_IDS.VISITEURS) : null;

            const canManageRecrues = !recruesRole || (me?.permissions.has('ManageRoles') && me.roles.highest.comparePositionTo(recruesRole) > 0);
            const canManageMembres = !membresRole || (me?.permissions.has('ManageRoles') && me.roles.highest.comparePositionTo(membresRole) > 0);
            const canManageVisiteurs = !visiteursRole || (me?.permissions.has('ManageRoles') && me.roles.highest.comparePositionTo(visiteursRole) > 0);
            
            const canManage = canManageRecrues && canManageMembres && canManageVisiteurs;

            if (canManage) {
              if (action === 'accept') {
                // ACCEPTÉE : RECRUES → MEMBRES
                if (ROLE_IDS.RECRUES && member.roles.cache.has(ROLE_IDS.RECRUES)) {
                  await member.roles.remove(ROLE_IDS.RECRUES, `candidature acceptée (${id})`);
                }
                if (ROLE_IDS.MEMBRES && !member.roles.cache.has(ROLE_IDS.MEMBRES)) {
                  await member.roles.add(ROLE_IDS.MEMBRES, `candidature acceptée (${id})`);
                }
                extraNote = ' — ✅ Roleswap RECRUES → MEMBRES effectué';
              } else {
                // REFUSÉE : RECRUES → VISITEURS
                if (ROLE_IDS.RECRUES && member.roles.cache.has(ROLE_IDS.RECRUES)) {
                  await member.roles.remove(ROLE_IDS.RECRUES, `candidature refusée (${id})`);
                }
                if (ROLE_IDS.VISITEURS && !member.roles.cache.has(ROLE_IDS.VISITEURS)) {
                  await member.roles.add(ROLE_IDS.VISITEURS, `candidature refusée (${id})`);
                }
                extraNote = ' — ✅ Roleswap RECRUES → VISITEURS effectué';
              }
            } else {
              extraNote = ' — ⚠️ perms/hiérarchie rôles insuffisantes';
            }
          } else {
            extraNote = ' — ⚠️ membre introuvable (a quitté ?)';
          }
        }
      } catch (err) {
        extraNote = ` — ⚠️ Erreur roleswap: ${(err as Error).message}`;
      }

      // log public
      await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, {
        content: `**${action === 'accept' ? '✅ Acceptée' : '❌ Refusée'}** par <@${interaction.user.id}> — candidature **${id}** de <@${entry.user_id}> — ${entry.message_url ? `[lien](${entry.message_url})` : '(pas de lien)'}${extraNote}`,
      });

      // DM best-effort
      try {
        const user = await interaction.client.users.fetch(entry.user_id);
        if (action === 'accept') {
          const acceptMsg = [
            `🎉 **Félicitations !**`,
            ``,
            `Ta candidature a été **acceptée** ! Bienvenue dans la guilde ! 🎊`,
            ``,
            `**Quelques infos pour bien démarrer :**`,
            `• Tu as maintenant accès à tous les channels de la guilde`,
            `• N'hésite pas à te présenter et à participer aux discussions`,
            `• Consulte les annonces importantes pour rester à jour`,
            `• Si tu as des questions, n'hésite surtout pas à les poser aux officiers ou aux membres`,
            ``,
            `**Important :** Pense à faire tes CR (Castle Rush) quotidiennement et à participer aux événements de la guilde !`,
            ``,
            `On est ravis de t'accueillir parmi nous ! 🚀`,
          ].join('\n');
          await user.send(acceptMsg);
        } else {
          const rejectMsg = [
            `👋 **Candidature refusée**`,
            ``,
            `Merci pour l'intérêt porté à notre guilde ! Malheureusement, ton profil ne correspond pas à nos critères à l'heure actuelle.`,
            ``,
            `**Mais pas de soucis !** 😊`,
            `• Tu peux rester sur le Discord pour discuter dans les channels disponibles`,
            `• N'hésite pas à demander des conseils et de l'aide pour progresser`,
            `• Tu pourras repostuler plus tard une fois que ton compte aura évolué`,
            ``,
            `**Ce qu'on recherche généralement :**`,
            `• Un niveau de compte suffisant et une progression active (notamment en aventure et Tour)`,
            `• Une participation régulière et un esprit d'équipe`,
            `• De la motivation pour les événements de guilde`,
            ``,
            `Continue à progresser et à participer aux discussions, on sera ravis de réexaminer ta candidature plus tard ! 💪`,
          ].join('\n');
          await user.send(rejectMsg);
        }
      } catch {}

      await interaction.reply({ content: `${action === 'accept' ? '✅ Acceptée' : '❌ Refusée'} (${id}).`, ephemeral: true });

      // rafraichir la page courante via footer Page X/Y si dispo
      const footerText = interaction.message.embeds[0]?.footer?.text ?? '';
      const m = footerText.match(/Page\s+(\d+)\/(\d+)/);
      const curPage = m ? Number(m[1]) : 1;

      const fakeSlash = {
        ...interaction,
        options: { 
          getSubcommand: () => 'list', 
          getInteger: () => curPage 
        },
        inGuild: () => interaction.inGuild(),
        isChatInputCommand: () => true,
        deferReply: interaction.deferUpdate.bind(interaction),
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
