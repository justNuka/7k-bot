// Dotenv
import 'dotenv/config';

// DB imports
import { runMigrations, migrateFromJsonIfEmpty } from './db/init.js';

// Discord imports
import { Client, GatewayIntentBits, EmbedBuilder, ActivityType, Partials } from 'discord.js';

// Lib imports
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Notifs utils
import { loadNotifs } from './jobs/notifs.js';
import { ensurePresetNotifs } from './jobs/notifs.js';
import { reloadAllNotifs } from './jobs/notifs.js';
import { handleNotifButton } from './handlers/notifButtons.js';

// Commands
import * as helpCmd from './commands/help.js';
import * as helpadminCmd from './commands/helpadmin.js';
import * as gdocCmd from './commands/gdoc.js';
import * as infoserveurCmd from './commands/infoserveur.js';
import * as oubliCrCmd from './commands/oubli-cr.js';
import * as lowScoreCmd from './commands/low-score.js';
import * as notifCmd from './commands/notif.js';
import * as notifPanelCmd from './commands/notifpanel.js';
import * as banniereCmd from './commands/banniere.js';
import * as rolesetCmd from './commands/roleset.js';
import * as scrapeCmd from './commands/scrape.js';
import * as candidaturesCmd from './commands/candidatures.js';
import * as absenceCmd from './commands/absence.js';
import * as kickCmd from './commands/kick.js';
import * as ytCmd from './commands/yt.js';
import * as ytrouteCmd from './commands/ytroute.js';
import * as signalementCmd from './commands/signalement.js';
import diag, * as diagCmg from './commands/diag.js';
import * as coachingCmd from './commands/coaching.js';
import * as changelogCmg from './commands/changelog.js';
import * as pingoffCmd from './commands/pingoff.js';

// Utils
import { sendToChannel } from './utils/send.js'; // envoi de messages
import { onGuildMemberAdd } from './handlers/memberWelcome.js'; // welcome + auto-assign recrues

// Jobs
import { registerWeeklyResetJob } from './jobs/crWeeklyReset.js'; // import du job hebdo de reset CR
import { registerScrapeJob } from './jobs/scrapeNetmarble.js'; // import du job de scraping
import { startAbsenceCleanup, cleanupOnce } from './jobs/absences.js'; // import du job de purge des absences
import { registerYTWatchJob } from './jobs/ytWatch.js'; // import du job de veille YT

// Helpers
import { onCandidatureMessage } from './handlers/candidatureWatcher.js';
import { handleCandidaturesButton } from './commands/candidatures.js';
import { readJson, writeJson } from './utils/storage.js';
import { refreshPanelAll } from './utils/notifPanel.js';

// Types
type CRCounters = Record<string, number>;

// HTTP Server
import { startHttpServer } from './http/server.js';
import { bindDiscordClient } from './http/context.js';
import { handleCrButtons } from './handlers/crButtons.js';
import { announceVersionIfNeeded } from './startup/versionAnnounce.js';


// ------------------------------------------------------------------------ //


dayjs.extend(utc);
dayjs.extend(timezone);

// Map des commandes
const commandMap = new Map<string, { execute: Function }>([
  ['help', helpCmd],
  ['helpadmin', helpadminCmd],
  ['gdoc', gdocCmd],
  ['infoserveur', infoserveurCmd],
  ['oubli-cr', oubliCrCmd],
  ['low-score', lowScoreCmd],
  ['notif', notifCmd],
  ['notifpanel', notifPanelCmd],
  ['banniere', banniereCmd],
  ['roleset', rolesetCmd],
  ['scrape', scrapeCmd],
  ['candidatures', candidaturesCmd],
  ['absence', absenceCmd],
  ['kick', kickCmd],
  ['yt', ytCmd],
  ['ytroute', ytrouteCmd],
  ['signalement', signalementCmd],
  ['diag', diagCmg],
  ['coaching', coachingCmd],
  ['changelog', changelogCmg],
  ['pingoff', pingoffCmd],
]);

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

// Vérif que le bot est prêt
client.once('clientReady', async () => {
  console.log(`Connecté comme ${client.user?.tag}`);

  announceVersionIfNeeded(client); // Vérifie si besoin de faire une annonce pour le changelog

  registerWeeklyResetJob(client); // job CR hebdo

  registerScrapeJob(client); // job scraping Netmarble

  await cleanupOnce();       // purge immédiate au boot
  startAbsenceCleanup();     // planifie la purge quotidienne

  await refreshPanelAll(client); // refresh du panneau de notifs au boot

  registerYTWatchJob(client); // job de veille YouTube

  runMigrations();
  await migrateFromJsonIfEmpty();

  bindDiscordClient(client); // bind le client Discord au contexte HTTP
  await startHttpServer(client); // démarre le serveur HTTP pour envoyer les données au dashboard

  client.user?.setPresence({
    activities: [{ name: 'Masamune Guild Server', type: ActivityType.Watching }],
    status: 'online'
  });
  if (process.env.ANNOUNCE_CHANNEL_ID) {
    await sendToChannel(client, process.env.ANNOUNCE_CHANNEL_ID, '✅ Bibou au rapport ! Le bot est en ligne et fonctionnel.');
  }
  try {
    // 1) s'assurer des presets (création/màj si .env est rempli)
    await ensurePresetNotifs(client, client.user?.id || 'system');

    // 2) charger les notifs depuis le fichier et les (re)lancer
    const notifs = await loadNotifs();
    reloadAllNotifs(client, notifs);

    console.log(`[NOTIF] ${notifs.length} notification(s) planifiée(s).`);
    console.log('[NOTIF] scheduler prêt.');
  } catch (e) {
    console.error('[NOTIF] init failed:', e);
  }
});

// Création des interactions
client.on('interactionCreate', async (i) => {
  try {
    // Buttons
    if (i.isButton()) {
      // 1) Boutons CR
      const handled = await handleCrButtons(i);
      if (handled) return;

      // 2) Notif toggles
      if (i.customId.startsWith('notif:toggle:')) {
        await handleNotifButton(i);
        await refreshPanelAll(i.client);
        return;
      }

      // 3) Candidatures
      if (i.customId.startsWith('cand:')) {
        return handleCandidaturesButton(i);
      }

      return;
    }

    // Commands
    if (i.isChatInputCommand()) {
      const cmd = commandMap.get(i.commandName);
      if (!cmd) return i.reply({ content: 'Commande inconnue.', ephemeral: true });
      await cmd.execute(i);
      return;
    }

    // Autocompletes
    if (i.isAutocomplete()) {
      const cmd = i.commandName;

      // Bannières
      if (cmd === 'banniere') {
        const focused = i.options.getFocused(true);
        if (focused.name === 'id') {
          const list = await readJson<any[]>('src/data/banners.json', []);
          const now = Date.now();
          const choices = list
            .filter(b => new Date(b.end).getTime() > now)
            .slice(-25)                    // protège le nombre de résultats
            .reverse()
            .map(b => ({ name: `${b.name} — ${b.id}`, value: b.id }));
          await i.respond(choices);
        }
      }

      // Signalements
      if (cmd === 'signalement') {
        const focused = i.options.getFocused(true);
        if (focused.name === 'id') {
          const list = await readJson<any[]>('src/data/reports.json', []);
          const q = String(focused.value || '').toLowerCase();
          const items = list
            .sort((a,b)=> b.createdAt.localeCompare(a.createdAt))
            .slice(0,25)
            .map((r: any) => ({
              name: `${r.id} — ${r.note.slice(0,40)}`,
              value: r.id
            }))
            .filter((c: any) => !q || c.name.toLowerCase().includes(q));
          await i.respond(items);
        }
      }
    }
  } catch (e) {
    console.error('interaction handler error:', e);
  }
});

// Pour envoyer un DM de bienvenue + auto-assign recrues (ou envoyer un message dans #welcome si DM fermé)
client.on('guildMemberAdd', onGuildMemberAdd);

client.on('messageCreate', onCandidatureMessage);

client.login(process.env.DISCORD_TOKEN);
