/**
 * Script pour tester manuellement le job de scraping Netmarble
 * Usage: npm run test:scrape:notify
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { scrapeOnceAndNotify } from '../jobs/scrapeNetmarble.js';
import { createLogger } from '../utils/logger.js';
import { validateEnv } from '../config/env.js';

const log = createLogger('TestScrapeNotify');

async function main() {
  log.info('🧪 Test du job de scraping avec notification Discord...');
  
  // Valider l'environnement
  const env = validateEnv();
  
  // Créer un client Discord minimal
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  
  // Connexion
  await client.login(env.DISCORD_TOKEN);
  
  log.info('✅ Bot connecté à Discord');
  
  // Attendre que le client soit prêt
  await new Promise<void>((resolve) => {
    client.once('ready', () => {
      log.info({ tag: client.user?.tag }, 'Client Discord prêt');
      resolve();
    });
  });
  
  // Exécuter le scraping
  log.info('🔍 Lancement du scraping...');
  await scrapeOnceAndNotify(client);
  
  log.info('✅ Scraping terminé');
  
  // Attendre 2 secondes pour laisser les messages partir
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Déconnexion
  client.destroy();
  log.info('👋 Déconnexion du bot');
  
  process.exit(0);
}

main().catch((error) => {
  log.fatal({ error }, '💥 Erreur fatale');
  process.exit(1);
});
