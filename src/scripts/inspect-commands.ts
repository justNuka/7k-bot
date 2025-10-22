import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
const appId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.GUILD_ID!;

async function main() {
  const globalCmds = await rest.get(Routes.applicationCommands(appId)) as any[];
  console.log('Global:', globalCmds.map(c => c.name));
  if (guildId) {
    const guildCmds = await rest.get(Routes.applicationGuildCommands(appId, guildId)) as any[];
    console.log('Guild:', guildCmds.map(c => c.name));
  }
}
main();
