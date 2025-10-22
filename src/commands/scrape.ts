import { SlashCommandBuilder } from 'discord.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/access.js';
import { fetchCategoryList, fetchArticleDetail, NmCategoryKey } from '../scrapers/netmarble.js';
import { safeError } from '../utils/reply.js';
import { makeEmbed } from '../utils/embed.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pushLog } from '../http/logs.js';

export const data = new SlashCommandBuilder()
  .setName('scrape')
  .setDescription('Scraper Netmarble (tests • officiers)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Liste les 5 derniers items par catégorie')
    .addStringOption(o => o.setName('cat').setDescription('Catégorie').setRequired(true).addChoices(
      { name: 'notices', value: 'notices' },
      { name: 'updates', value: 'updates' },
      { name: 'known issues', value: 'known' },
      { name: 'developer notes', value: 'devnotes' },
    ))
  )
  .addSubcommand(sc => sc
    .setName('view')
    .setDescription('Récupère le contenu détaillé d’un article')
    .addStringOption(o => o.setName('url').setDescription('URL /sk_rebirth_gl/view/...').setRequired(true))
  )
  .addSubcommand(sc => sc
    .setName('dump')
    .setDescription('Dump brut HTML vers un .txt (debug si parsing KO)')
    .addStringOption(o => o.setName('url').setDescription('URL complète').setRequired(true))
  );

export async function execute(interaction: any) {
  const rule = COMMAND_RULES['scrape']; // mêmes gardes (officiers + cr-logs)
  if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels }))) return;

  const sub = interaction.options.getSubcommand(true);
  try {
    await interaction.deferReply({ ephemeral: true });

    if (sub === 'list') {
      const cat = interaction.options.getString('cat', true) as NmCategoryKey;
      const list = await fetchCategoryList(cat);
      const slice = list.slice(0,5).map(x => `• **${x.title}** — ${x.date ?? ''}\n<${x.url}>`).join('\n\n') || '—';
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'scrape',
        msg: `[SCRAPE] /scrape list ${cat} by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, category: cat }
      });

      return interaction.editReply({ embeds: [makeEmbed({ title: `Derniers (${cat})`, description: slice })] });
    }

    if (sub === 'view') {
      const url = interaction.options.getString('url', true);
      const d = await fetchArticleDetail(url);
      const desc = d.text.slice(0, 1500) + (d.text.length > 1500 ? '…' : '');
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'scrape',
        msg: `[SCRAPE] /scrape view ${url} by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, articleUrl: url }
      });

      return interaction.editReply({ embeds: [makeEmbed({ title: d.title, url, description: desc })] });
    }

    if (sub === 'dump') {
      const url = interaction.options.getString('url', true);
      const res = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://forum.netmarble.com' } })).text();
      const outDir = path.resolve('src/data/dumps');
      await fs.mkdir(outDir, { recursive: true });
      const file = path.join(outDir, 'dump_' + Date.now() + '.txt');
      await fs.writeFile(file, res, 'utf8');
      pushLog({
        ts: new Date().toISOString(),
        level: 'info',
        component: 'scrape',
        msg: `[SCRAPE] /scrape dump ${url} by ${interaction.user.tag}`,
        meta: { userId: interaction.user.id, articleUrl: url, file }
      });

      return interaction.editReply(`✅ Dump écrit → \`${file}\``);
    }

  } catch (e) {
    console.error(e);
    await safeError(interaction, 'Erreur sur /scrape.');
    pushLog({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'scrape',
      msg: `[SCRAPE] /scrape ${sub} error by ${interaction.user.tag}`,
      meta: { userId: interaction.user.id, subcommand: sub, error: (e as Error).message }
    });
    return;
  }
}

export default { data, execute };
