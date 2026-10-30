import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
const commands = [new SlashCommandBuilder().setName('ticket-panel').setDescription('Publish the ticket creation panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)];
await new REST().setToken(process.env.DISCORD_TOKEN).put(Routes.applicationGuildCommands(process.env.APPLICATION_ID, process.env.GUILD_ID), {body:commands.map(c=>c.toJSON())});
console.log('Registered guild commands.');
