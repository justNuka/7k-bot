import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Colors, EmbedBuilder } from 'discord.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { loadCandStore, saveCandStore, type CandidatureOpen } from '../utils/candidatures.js';
import { makeEmbed } from '../utils/embed.js';
import { safeError } from '../utils/reply.js';
import { officerDefer, officerEdit } from '../utils/officerReply.js';
import { sendToChannel } from '../utils/send.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { discordAbsolute } from '../utils/time.js';
import { pushLog } from '../http/logs.js';

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
    const store = await loadCandStore();
    const total = store.open.length;
    if (!total) {
      return officerEdit(interaction, 'Aucune candidature ouverte.');
    }

    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const cur = Math.min(Math.max(1, page), maxPage);
    const start = (cur - 1) * PAGE_SIZE;
    const slice = store.open.slice(start, start + PAGE_SIZE);

    const emb = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`📋 Candidatures ouvertes — ${total} en attente`)
      .setFooter({ text: `Page ${cur}/${maxPage}` })
      .setTimestamp();

    emb.setDescription(
      slice.map(c => {
        const when = discordAbsolute(c.createdAt, 'f');
        return `• **#${c.id}** — <@${c.userId}> — ${when} — [lien](${c.jumpLink})`;
      }).join('\n')
    );

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Ligne de pagination
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`cand:page:${cur - 1}`).setStyle(ButtonStyle.Secondary).setLabel('⬅️ Précédent').setDisabled(cur <= 1),
      new ButtonBuilder().setCustomId(`cand:page:${cur + 1}`).setStyle(ButtonStyle.Secondary).setLabel('Suivant ➡️').setDisabled(cur >= maxPage),
    ));

    // Lignes d’actions (accept/refuse) — une rangée pour chaque entrée
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
    // only officers
    const isOfficer = interaction.member && 'roles' in interaction.member
      ? interaction.member.roles instanceof Map
        ? (interaction.member.roles as any).has(ROLE_IDS.OFFICIERS)
        : (interaction.member.roles as any).cache?.has?.(ROLE_IDS.OFFICIERS)
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

    const parts = interaction.customId.split(':'); // cand:accept:12 | cand:reject:12 | cand:page:2
    if (parts[0] !== 'cand') return;

    const action = parts[1];
    const arg = parts[2];

    const store = await loadCandStore();

    if (action === 'page') {
      // on relance la commande avec la nouvelle page (simple: on édite le message en appelant la logique)
      const fakeSlash = {
        ...interaction,
        options: { getSubcommand: () => 'list', getInteger: () => Number(arg) },
      } as any as ChatInputCommandInteraction;
      // réutilise execute pour générer l'embed
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
      const id = Number(arg);
      const idx = store.open.findIndex(o => o.id === id);
      if (idx === -1) {
        pushLog({ 
          ts: new Date().toISOString(),
          level: 'warn',
          component: 'candidatures',
          msg: `Candidature #${id} introuvable pour ${action} par <@${interaction.user.id}>`,
          meta: {}
        });
        return interaction.reply({ content: `❌ Candidature #${id} introuvable (déjà traitée ?).`, ephemeral: true });
      }
      const entry = store.open[idx];
      store.open.splice(idx, 1);
      store.closed.push({
          ...entry,
          closedAt: new Date().toISOString(),
          status: action === 'accept' ? 'accepted' : 'rejected',
          moderatorId: interaction.user.id,
      });
      await saveCandStore(store);

      // --- LOGIQUE ROLESWAP SI ACCEPT ---
      let swapNote = '';
      if (action === 'accept') {
          try {
          const guild = await interaction.client.guilds.fetch(entry.guildId);
          const member = await guild.members.fetch(entry.userId).catch(() => null);

          if (!member) {
              swapNote = '⚠️ Membre introuvable sur le serveur (a quitté ?).';
          } else {
              // Vérifs perms & hiérarchie
              const me = guild.members.me;
              const canManage =
              me?.permissions.has('ManageRoles') &&
              (!ROLE_IDS.RECRUES || me.roles.highest.comparePositionTo(guild.roles.cache.get(ROLE_IDS.RECRUES)!) > 0) &&
              (!ROLE_IDS.MEMBRES || me.roles.highest.comparePositionTo(guild.roles.cache.get(ROLE_IDS.MEMBRES)!) > 0);

              if (!canManage) {
              swapNote = '⚠️ Impossible de gérer les rôles (permissions/hiérarchie).';
              } else {
              // Applique: +MEMBRES, -RECRUES
              if (ROLE_IDS.MEMBRES && !member.roles.cache.has(ROLE_IDS.MEMBRES)) {
                  await member.roles.add(ROLE_IDS.MEMBRES, `candidature acceptée (#${id})`);
              }
              if (ROLE_IDS.RECRUES && member.roles.cache.has(ROLE_IDS.RECRUES)) {
                  await member.roles.remove(ROLE_IDS.RECRUES, `candidature acceptée (#${id})`);
              }
              swapNote = '✅ Roleswap effectué (+Membres, -Recrues).';
              }

              pushLog({
                ts: new Date().toISOString(),
                level: 'info',
                component: 'candidatures',
                msg: `Roleswap effectué pour <@${entry.userId}> suite à l'acceptation de la candidature #${id}`,
                meta: { moderatorId: interaction.user.id }
              });
            }
          } catch (e) {
            console.error('[candidatures accept roleswap] error:', e);
            swapNote = '⚠️ Erreur lors du roleswap.';
            pushLog({
              ts: new Date().toISOString(),
              level: 'error',
              component: 'candidatures',
              msg: `Erreur lors du roleswap pour <@${entry.userId}> suite à l'acceptation de la candidature #${id}`,
              meta: { moderatorId: interaction.user.id, error: (e as Error).message }
            });
          }
      }

      // --- LOG PUBLIC DANS #retours-bot ---
      const verb = action === 'accept' ? '✅ Acceptée' : '❌ Refusée';
      const extra = action === 'accept' ? (swapNote ? `\n${swapNote}` : '') : '';
      await sendToChannel(interaction.client, CHANNEL_IDS.RETOURS_BOT, {
          content: `**${verb}** par <@${interaction.user.id}> — candidature **#${id}** de <@${entry.userId}> — [lien](${entry.jumpLink})${extra}`,
      });

      // --- DM AU CANDIDAT (best effort) ---
      try {
          const user = await interaction.client.users.fetch(entry.userId);
          if (action === 'accept') {
          await user.send(
              `🎉 Ta candidature (**#${id}**) a été **acceptée** ! Bienvenue parmi les membres de la guilde.\n` +
              `Passe dire bonjour et n’hésite pas à lire les salons d’informations.`
          );
          } else {
          await user.send(
              `👋 Ta candidature (**#${id}**) a été **refusée**. Merci pour l’intérêt porté à la guilde, et bonne continuation !`
          );
          }
      } catch {
          /* DMs fermés : on ignore */
      }

      await interaction.reply({ content: `${verb} (#${id}).`, ephemeral: true });

      // --- rafraîchit la page courante ---
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
