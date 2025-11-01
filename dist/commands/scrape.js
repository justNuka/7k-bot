import { SlashCommandBuilder } from 'discord.js';
import { COMMAND_RULES } from '../config/permissions.js';
import { requireAccess } from '../utils/discord/access.js';
import { fetchCategoryList } from '../scrapers/netmarble.js';
import { safeError } from '../utils/discord/reply.js';
import { makeEmbed } from '../utils/formatting/embed.js';
import { pushLog } from '../http/logs.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('cmd:scrape');
export const data = new SlashCommandBuilder()
    .setName('scrape')
    .setDescription('Scraper Netmarble (tests • officiers)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0n)
    .addSubcommand(sc => sc
    .setName('list')
    .setDescription('Liste les derniers articles par catégorie')
    .addStringOption(o => o.setName('cat').setDescription('Catégorie').setRequired(true).addChoices({ name: 'notices', value: 'notices' }, { name: 'updates', value: 'updates' }, { name: 'known issues', value: 'known' }, { name: 'developer notes', value: 'devnotes' })));
export async function execute(interaction) {
    const rule = COMMAND_RULES['scrape']; // mêmes gardes (officiers + cr-logs)
    if (!(await requireAccess(interaction, { roles: rule.roles, channels: rule.channels })))
        return;
    const sub = interaction.options.getSubcommand(true);
    try {
        await interaction.deferReply({ ephemeral: true });
        if (sub === 'list') {
            const cat = interaction.options.getString('cat', true);
            const list = await fetchCategoryList(cat);
            const slice = list.slice(0, 5).map(x => `• **${x.title}** — ${x.date ?? ''}\n<${x.url}>`).join('\n\n') || '—';
            pushLog({
                ts: new Date().toISOString(),
                level: 'info',
                component: 'scrape',
                msg: `[SCRAPE] /scrape list ${cat} by ${interaction.user.tag}`,
                meta: { userId: interaction.user.id, category: cat }
            });
            return interaction.editReply({ embeds: [makeEmbed({ title: `Derniers (${cat})`, description: slice })] });
        }
    }
    catch (e) {
        log.error({ error: e, userId: interaction.user.id }, 'Erreur commande /scrape');
        await safeError(interaction, 'Erreur sur /scrape.');
        pushLog({
            ts: new Date().toISOString(),
            level: 'error',
            component: 'scrape',
            msg: `[SCRAPE] /scrape ${sub} error by ${interaction.user.tag}`,
            meta: { userId: interaction.user.id, subcommand: sub, error: e.message }
        });
        return;
    }
}
export default { data, execute };
