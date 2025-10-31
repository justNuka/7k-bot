/**
 * Point d'entrée principal du bot Discord 7K Rebirth
 * Gère l'initialisation, les événements et le routing des interactions
 */

// Dotenv
import 'dotenv/config';

// Discord
import { Client, GatewayIntentBits, ActivityType, Partials } from 'discord.js';

// Lib
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Core
import { loadCommands } from './core/commandLoader.js';
import { routeInteraction } from './core/interactionRouter.js';

// DB
import { runMigrations } from './db/init.js';

// Jobs
import { registerWeeklyResetJob } from './jobs/crWeeklyReset.js';
import { registerScrapeJob } from './jobs/scrapeNetmarble.js';
import { startAbsenceCleanup, cleanupOnce } from './jobs/absences.js';
import { registerYTWatchJob } from './jobs/ytWatch.js';
import { loadNotifs, ensurePresetNotifs, reloadAllNotifs } from './jobs/notifs.js';

// Handlers
import { onGuildMemberAdd } from './handlers/memberWelcome.js';
import { onCandidatureMessage } from './handlers/candidatureWatcher.js';

// Utils
import { sendToChannel } from './utils/send.js';
import { refreshPanelAll } from './utils/notifPanel.js';

// HTTP
import { startHttpServer } from './http/server.js';
import { bindDiscordClient } from './http/context.js';

// Startup
import { announceVersionIfNeeded } from './startup/versionAnnounce.js';

// ------------------------------------------------------------------------ //

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Initialise et démarre le bot Discord
 */
async function main() {
  // Charger les commandes
  const commandMap = await loadCommands();
  console.log(`[BOT] ${commandMap.size} commandes chargées.`);

  // Créer le client Discord
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Event: Bot prêt
  client.once('clientReady', async () => {
    console.log(`Connecté comme ${client.user?.tag}`);

    // Migrations DB
    runMigrations();

    // Annonce changelog si nécessaire
    announceVersionIfNeeded(client);

    // Jobs en arrière-plan
    registerWeeklyResetJob(client);
    registerScrapeJob(client);
    registerYTWatchJob(client);
    
    // Nettoyage absences
    await cleanupOnce();
    startAbsenceCleanup();

    // Refresh panel notifs
    await refreshPanelAll(client);

    // Serveur HTTP pour dashboard
    bindDiscordClient(client);
    await startHttpServer(client);

    // Présence Discord
    client.user?.setPresence({
      activities: [{ name: 'Masamune Guild Server', type: ActivityType.Watching }],
      status: 'online'
    });

    // Message de démarrage
    if (process.env.ANNOUNCE_CHANNEL_ID) {
      await sendToChannel(client, process.env.ANNOUNCE_CHANNEL_ID, '✅ Bibou au rapport ! Le bot est en ligne et fonctionnel.');
    }

    // Notifications programmées
    try {
      await ensurePresetNotifs(client, client.user?.id || 'system');
      const notifs = await loadNotifs();
      reloadAllNotifs(client, notifs);
      console.log(`[NOTIF] ${notifs.length} notification(s) planifiée(s).`);
    } catch (e) {
      console.error('[NOTIF] init failed:', e);
    }
  });

  // Event: Interactions (commandes, boutons, autocomplete)
  client.on('interactionCreate', async (interaction) => {
    try {
      await routeInteraction(interaction, commandMap);
      
      // Refresh panel si bouton notif
      if (interaction.isButton() && interaction.customId.startsWith('notif:toggle:')) {
        await refreshPanelAll(interaction.client);
      }
    } catch (e) {
      console.error('[BOT] Interaction error:', e);
    }
  });

  // Event: Nouveau membre (welcome + auto-assign rôle)
  client.on('guildMemberAdd', onGuildMemberAdd);

  // Event: Message de candidature
  client.on('messageCreate', onCandidatureMessage);

  // Connexion
  await client.login(process.env.DISCORD_TOKEN);
}

// Démarrage
main().catch((err) => {
  console.error('[BOT] Fatal error:', err);
  process.exit(1);
});
