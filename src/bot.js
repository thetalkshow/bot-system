import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits as P, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } from 'discord.js';
import { ticketMessage } from './messages.js';
import { config, validateConfig } from './config.js';
import { tickets, save } from './store.js';
import { TYPES, rankIndex, memberRank, canEscalate, escalationOptions, status, canSpeak } from './policy.js';
validateConfig();
const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const locks = new Set();
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const button = (id,label,style=ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const controls = () => row(button('claim','Claim',ButtonStyle.Success),button('escalate','Escalate',ButtonStyle.Primary),button('close','Close',ButtonStyle.Danger));
function overwrites(guild,t) {
  const base = [
    {id:guild.id,deny:[P.ViewChannel]},
    {id:client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.ManageChannels]},
    {id:t.ownerId,allow:t.ownership?[]:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.AttachFiles],deny:t.ownership?[P.ViewChannel,P.SendMessages]:[]}
  ];
  config.ranks.forEach((r,i) => {
    const visible = i >= rankIndex(config,t.ownership?'ownership':t.minimum);
    base.push({id:r.roleId,allow:visible?[P.ViewChannel,P.ReadMessageHistory,...(canSpeak(config,t,i)?[P.SendMessages,P.AttachFiles]:[])]:[],deny:[...(!visible?[P.ViewChannel]:[]),...(!canSpeak(config,t,i)?[P.SendMessages]:[])]});
  });
  if(t.claimedBy && !t.ownership) base.push({id:t.claimedBy,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.AttachFiles]});
  return base;
}
async function refresh(channel,t) {
  const name = `${status(t)}-${t.type}-${t.number}`;
  if(channel.name !== name) await channel.setName(name);
}
async function apply(channel,t) {
  await channel.permissionOverwrites.set(overwrites(channel.guild,t));
  await refresh(channel,t);
}
async function transcript(channel) {
  const lines=[]; let before;
  for(;;) {
    const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});
    if(!batch.size) break;
    for(const m of batch.values()) lines.push({at:m.createdTimestamp,text:`${m.createdAt.toISOString()} ${m.author.tag} (${m.author.id}): ${m.content}\n${m.attachments.map(a=>a.url).join('\n')}${m.embeds.length?'\n[Embeds] '+JSON.stringify(m.embeds.map(e=>e.toJSON())):''}${m.components.length?'\n[Components] '+JSON.stringify(m.components.map(c=>c.toJSON())):''}`});
    before=batch.last().id;
  }
  return Buffer.from(lines.sort((a,b)=>a.at-b.at).map(l=>l.text).join('\n\n'));
}
client.on('interactionCreate',async i => {
  if(!i.inGuild()) return;
  const lock = i.customId?.startsWith('open:') ? `open:${i.guildId}:${i.user.id}` : i.channelId;
  if(locks.has(lock)) { await i.reply({content:'Another ticket action is in progress. Try again shortly.',ephemeral:true}); return; }
  locks.add(lock);
  try {
    if(i.isChatInputCommand() && i.commandName==='ticket-panel') {
      if(!i.memberPermissions.has(P.ManageGuild)) throw new Error('Manage Server permission required.');
      await i.deferReply({ephemeral:true});
      const channel=await i.guild.channels.fetch(config.panelChannelId);
      await channel.send(ticketMessage('Support tickets','Choose a ticket type below. A private support channel will be created.', {actions:[row(...Object.entries(TYPES).map(([key,t])=>button(`open:${key}`,t.name,ButtonStyle.Primary)))]}));
      await i.editReply('Ticket panel published.'); return;
    }
    if(!i.isButton() && !i.isStringSelectMenu()) return;
    await i.deferReply({ephemeral:true});
    const member=await i.guild.members.fetch(i.user.id);
    if(i.customId.startsWith('open:')) {
      const type=i.customId.split(':')[1];
      if(!TYPES[type]) throw new Error('Unknown ticket type.');
      if(Object.values(tickets).some(t=>t.guildId===i.guildId && t.ownerId===i.user.id && !t.closed)) throw new Error('You already have an open ticket.');
      const t={guildId:i.guildId,ownerId:i.user.id,type,minimum:TYPES[type].minimum,number:i.id.slice(-8),claimedBy:null,createdAt:Date.now(),lastUserAt:0,lastStaffAt:0};
      const channel=await i.guild.channels.create({name:`🔴-${type}-${t.number}`,type:ChannelType.GuildText,parent:config.categories[type],permissionOverwrites:overwrites(i.guild,t)});
      tickets[channel.id]=t; save();
      await channel.send(ticketMessage(TYPES[type].name,`Opened by <@${i.user.id}>. Describe what you need help with.\nStatus: unclaimed. Staff can claim this ticket below.`,{pingRoleId:config.pingRoles[type],actions:[controls()]}));
      await i.editReply(`Your ticket: <#${channel.id}>`); return;
    }
    const t=tickets[i.channelId];
    if(!t || t.guildId!==i.guildId || t.closed) throw new Error('This ticket is closed or unavailable.');
    const rank=memberRank(config,member);
    if(i.customId==='claim') {
      if(t.ownership) throw new Error('Ownership tickets cannot be claimed.');
      if(rank<rankIndex(config,t.minimum)) throw new Error('Your rank cannot claim this ticket.');
      if(t.claimedBy) throw new Error('This ticket is already claimed.');
      const next={...t,claimedBy:i.user.id,claimRank:rank};
      await apply(i.channel,next); Object.assign(t,next); save();
      await i.channel.send(ticketMessage('Ticket claimed',`<@${i.user.id}> claimed this ticket as **${config.ranks[rank].name}**. Higher ranks can still respond.`));
      await i.editReply('Ticket claimed.');
    } else if(i.customId==='escalate') {
      if(!canEscalate(config,t,member)) throw new Error('Only the claimant or a supervisor with ticket access can escalate.');
      const options=escalationOptions(config,t);
      if(!options.length) throw new Error('No higher escalation destinations are available for this ticket type.');
      await i.editReply({content:'Select an escalation destination.',components:[row(new StringSelectMenuBuilder().setCustomId('escalation-target').setPlaceholder('Escalate to rank').addOptions(options.map(key=>({label:config.ranks.find(r=>r.key===key).name,value:key}))))]});
    } else if(i.customId==='escalation-target') {
      if(!canEscalate(config,t,member)) throw new Error('You cannot escalate this ticket.');
      const target=i.values[0];
      if(!escalationOptions(config,t).includes(target)) throw new Error('Invalid or outdated escalation destination.');
      const next={...t,minimum:target,escalated:true,ownership:target==='ownership',claimedBy:null,claimRank:null};
      if(next.ownership) await i.channel.setParent(config.categories.ownership,{lockPermissions:false});
      await apply(i.channel,next); Object.assign(t,next); save();
      const destination=config.ranks.find(r=>r.key===target);
      await i.channel.send(ticketMessage('Ticket escalated',`Escalated to **${destination.name}** by <@${i.user.id}>.${next.ownership?'\nAwaiting Ownership. Previous participants have been removed.':'\nThe previous claim has been cleared for the receiving team.'}`,{pingRoleId:destination.roleId}));
      await i.editReply({content:'Ticket escalated.',components:[]});
    } else if(i.customId==='close') {
      if(i.user.id!==t.ownerId && rank<rankIndex(config,t.minimum)) throw new Error('You cannot close this ticket.');
      await i.editReply({content:'Close this ticket? A transcript will be saved before deletion.',components:[row(button('confirm-close','Confirm close',ButtonStyle.Danger))]});
    } else if(i.customId==='confirm-close') {
      if(t.ownership ? rank<rankIndex(config,'ownership') : i.user.id!==t.ownerId && rank<rankIndex(config,t.minimum)) throw new Error('You cannot close this ticket.');
      if(!config.transcriptChannelId) throw new Error('Configure a private transcript channel before closing tickets.');
      const log=await i.guild.channels.fetch(config.transcriptChannelId);
      const content=await transcript(i.channel);
      await log.send({...ticketMessage('Ticket closed',`Ticket ${t.number} • ${TYPES[t.type].name}\nOwner: <@${t.ownerId}>\nClosed by: <@${i.user.id}>`,{attachmentName:`ticket-${t.number}.txt`}),files:[new AttachmentBuilder(content,{name:`ticket-${t.number}.txt`})]});
      await i.editReply({content:'Transcript saved. Closing ticket.',components:[]});
      await i.channel.delete('Ticket closed after transcript saved'); t.closed=true; save();
    }
  } catch(error) {
    console.error(error);
    const reply={content:error.message || 'Ticket action failed.',components:[],ephemeral:true};
    if(i.deferred || i.replied) await i.editReply(reply).catch(console.error); else await i.reply(reply).catch(console.error);
  } finally { locks.delete(lock); }
});
client.on('messageCreate',async m => {
  const t=tickets[m.channelId];
  if(!t || t.closed || m.author.bot) return;
  if(m.author.id===t.ownerId) {
    if(!t.pendingSince) t.pendingSince=Date.now();
    t.lastUserAt=Date.now();
  }
  else if(m.member && memberRank(config,m.member)>=rankIndex(config,t.minimum)) { t.lastStaffAt=Date.now(); t.pendingSince=null; }
  save();
});
client.once('clientReady',()=>{
  console.log(`Logged in as ${client.user.tag}`);
  const tick=async()=>{
    for(const [id,t] of Object.entries(tickets)) {
      if(t.closed || locks.has(id)) continue;
      locks.add(id);
      try { const channel=await client.channels.fetch(id); if(channel) await refresh(channel,t); }
      catch(error) { console.error(`Ticket ${id}:`,error.message); }
      finally { locks.delete(id); }
    }
  };
  void tick(); setInterval(()=>void tick(),60000);
});
await client.login(process.env.DISCORD_TOKEN);
