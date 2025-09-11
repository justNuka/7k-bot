import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
const appId = process.env.DISCORD_CLIENT_ID!;

(async () => {
  const cmds = await rest.get(Routes.applicationCommands(appId)) as any[];
  for (const c of cmds) {
    await rest.delete(Routes.applicationCommand(appId, c.id));
    console.log('Deleted global:', c.name);
  }
})();
