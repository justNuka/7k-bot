/**
 * Point d'entrée principal du bot Discord 7K Rebirth
 * Gère l'initialisation, les événements et le routing des interactions
 */

// Dotenv
import 'dotenv/config';

// Config
import { validateEnv, logEnvSummary } from './config/env.js';

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
import { onGuildMemberAdd } from './handlers/events/memberWelcome.js';
import { onCandidatureMessage } from './handlers/events/candidatureWatcher.js';

// Utils
import { sendToChannel } from './utils/discord/send.js';
import { refreshPanelAll } from './utils/notifPanel.js';
import { createLogger } from './utils/logger.js';

// HTTP
import { startHttpServer } from './http/server.js';
import { bindDiscordClient } from './http/context.js';

// Startup
import { announceVersionIfNeeded } from './startup/versionAnnounce.js';

// Logger
const log = createLogger('BOT');

// ------------------------------------------------------------------------ //

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Initialise et démarre le bot Discord
 */
async function main() {
  // Valider la configuration
  const env = validateEnv();
  logEnvSummary(env);

  // Charger les commandes
  const commandMap = await loadCommands();
  log.info({ count: commandMap.size }, 'Commandes chargées');

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
    log.info({ tag: client.user?.tag, id: client.user?.id }, 'Bot connecté');

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
      log.info({ count: notifs.length }, 'Notifications planifiées');
    } catch (e) {
      log.error({ err: e }, 'Échec initialisation notifications');
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
      log.error({ err: e }, 'Erreur traitement interaction');
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
  log.fatal({ err }, 'Erreur fatale au démarrage');
  process.exit(1);
});
