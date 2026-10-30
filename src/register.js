import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
const commands = [new SlashCommandBuilder().setName('ticket-panel').setDescription('Publish the ticket creation panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)];
const guildId = process.env.GUILD_ID || '1442304961458475082';
await new REST().setToken(process.env.DISCORD_TOKEN).put(Routes.applicationGuildCommands(process.env.APPLICATION_ID, guildId), {body:commands.map(c=>c.toJSON())});
console.log('Registered guild commands.');
