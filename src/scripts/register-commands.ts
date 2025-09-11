import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  // Time
  new SlashCommandBuilder().setName('time')
    .setDescription('Utilitaires horaires')
    .addStringOption(o => o.setName('type').setDescription('ex: reset').setRequired(true)),
  // Gemmes calc
  new SlashCommandBuilder().setName('calc')
    .setDescription('Calculateur de gemmes/pulls')
    .addIntegerOption(o => o.setName('gemmes').setDescription('Gemmes actuelles').setRequired(true))
    .addIntegerOption(o => o.setName('par_jour').setDescription('Gain quotidien').setRequired(true))
    .addStringOption(o => o.setName('jusquau').setDescription('YYYY-MM-DD').setRequired(true)),
  // Hero
  new SlashCommandBuilder().setName('hero')
    .setDescription('Fiche rapide d’un héros')
    .addStringOption(o => o.setName('nom').setDescription('Nom/clé du héros').setRequired(true)),
  // Tierlist
  new SlashCommandBuilder().setName('tier')
    .setDescription('Tierlist rapide')
    .addStringOption(o => o.setName('mode')
    .setDescription('pvp ou pve')
    .setRequired(true)
    .addChoices({name:'pvp', value:'pvp'}, {name:'pve', value:'pve'})),
  // Banners
  new SlashCommandBuilder().setName('banner').setDescription('Gestion des bannières')
    .addSubcommand(sc => sc.setName('next').setDescription('Prochaine bannière'))
    .addSubcommand(sc => sc.setName('list').setDescription('Lister les bannières'))
    .addSubcommand(sc => sc.setName('add').setDescription('Ajouter (admin)')
    .addStringOption(o => o.setName('name').setDescription('Nom').setRequired(true))
    .addStringOption(o => o.setName('start').setDescription('ISO date').setRequired(true))
    .addStringOption(o => o.setName('end').setDescription('ISO date').setRequired(true))),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  const appId = process.env.DISCORD_CLIENT_ID!;
  const guildId = process.env.DEV_GUILD_ID;

  if (guildId) {
    console.log(`→ Registering GUILD commands to ${guildId}…`);
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log('✅ Slash commands (guild) enregistrées');
  } else {
    console.log('→ Registering GLOBAL commands…');
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('✅ Slash commands (global) enregistrées');
  }
})();
