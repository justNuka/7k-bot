import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createBugReport } from '../db/bugs.js';
import { safeError } from '../utils/discord/reply.js';
import { sendToChannel } from '../utils/discord/send.js';
import { CHANNEL_IDS } from '../config/permissions.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('cmd:bug');
// Liste des commandes disponibles pour le choix
const COMMANDS = [
    'absence', 'banniere', 'candidatures', 'changelog', 'coaching',
    'cr', 'diag', 'gdoc', 'help', 'infoserveur', 'kick',
    'low-score', 'notif', 'notifpanel', 'oubli-cr', 'pingoff',
    'roleset', 'scrape', 'signalement', 'yt', 'ytroute'
];
export const data = new SlashCommandBuilder()
    .setName('bug')
    .setDescription('Signaler un bug ou un problème avec le bot')
    .setDMPermission(false)
    .addStringOption(o => o
    .setName('commande')
    .setDescription('Commande concernée (ou "Autre" si non lié à une commande)')
    .setRequired(true)
    .addChoices(...COMMANDS.map(cmd => ({ name: `/${cmd}`, value: cmd })), { name: '🔧 Autre (non lié à une commande)', value: 'autre' }))
    .addStringOption(o => o
    .setName('description')
    .setDescription('Description détaillée du problème')
    .setRequired(true)
    .setMaxLength(1000))
    .addStringOption(o => o
    .setName('erreur')
    .setDescription('Message d\'erreur affiché (si applicable)')
    .setRequired(false)
    .setMaxLength(500));
export async function execute(interaction) {
    const command = interaction.options.getString('commande', true);
    const description = interaction.options.getString('description', true);
    const error = interaction.options.getString('erreur', false);
    try {
        // Créer le bug report en DB
        const bug = createBugReport({
            user_id: interaction.user.id,
            command: command === 'autre' ? undefined : command,
            description,
            error_message: error || undefined
        });
        // Réponse à l'utilisateur (éphémère)
        const userEmbed = new EmbedBuilder()
            .setColor(0x57F287) // Vert
            .setTitle('✅ Bug signalé avec succès')
            .setDescription('Merci d\'avoir signalé ce problème ! Les officiers ont été notifiés.')
            .addFields({ name: '🆔 Référence', value: `\`${bug.id}\``, inline: true }, { name: '📝 Commande', value: command === 'autre' ? 'Autre' : `\`/${command}\``, inline: true }, { name: '💬 Description', value: description.length > 100 ? description.slice(0, 100) + '...' : description })
            .setFooter({ text: 'Les officiers examineront ton signalement rapidement.' })
            .setTimestamp();
        await interaction.reply({ embeds: [userEmbed], ephemeral: true });
        // Notification aux officiers
        const notifChannel = CHANNEL_IDS.RETOURS_BOT || CHANNEL_IDS.CR_LOGS;
        if (notifChannel) {
            const officerEmbed = new EmbedBuilder()
                .setColor(0xED4245) // Rouge
                .setTitle('🐛 Nouveau bug signalé')
                .setDescription(`<@${interaction.user.id}> a signalé un problème.`)
                .addFields({ name: '🆔 ID', value: `\`${bug.id}\``, inline: true }, { name: '📝 Commande', value: command === 'autre' ? 'Autre' : `\`/${command}\``, inline: true }, { name: '👤 Utilisateur', value: `<@${interaction.user.id}>`, inline: true }, { name: '💬 Description', value: description })
                .setFooter({ text: `Serveur: ${interaction.guild?.name || 'Inconnu'}` })
                .setTimestamp();
            if (error) {
                officerEmbed.addFields({
                    name: '⚠️ Message d\'erreur',
                    value: `\`\`\`${error}\`\`\``
                });
            }
            await sendToChannel(interaction.client, notifChannel, { embeds: [officerEmbed] });
        }
        log.info({
            bugId: bug.id,
            userId: interaction.user.id,
            command,
            hasError: !!error
        }, 'Bug report créé');
    }
    catch (e) {
        log.error({ error: e, userId: interaction.user.id }, 'Erreur création bug report');
        await safeError(interaction, '❌ Une erreur est survenue lors de l\'enregistrement du bug. Réessaye plus tard.');
    }
}
export default { data, execute };
