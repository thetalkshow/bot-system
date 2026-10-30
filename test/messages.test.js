import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { ticketMessage } from '../src/messages.js';

test('ticket panel serializes as Components V2 with functional action row', () => {
  const action = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Success));
  const message = ticketMessage('Support tickets', 'Choose a ticket.', {actions:[action]});
  assert.equal(message.flags, MessageFlags.IsComponentsV2);
  assert.equal('embeds' in message, false);
  assert.equal('content' in message, false);
  const container = message.components[0].toJSON();
  assert.equal(container.type, ComponentType.Container);
  assert.equal(container.components[0].type, ComponentType.TextDisplay);
  assert.equal(container.components[1].components[0].custom_id, 'claim');
});

test('role ping uses text display and only allows the intended role mention', () => {
  const message = ticketMessage('Escalated', 'Awaiting staff.', {pingRoleId:'1442304961957462140'});
  assert.equal(message.components[0].toJSON().content, '<@&1442304961957462140>');
  assert.deepEqual(message.allowedMentions, {parse:[],roles:['1442304961957462140']});
});

test('transcript attachment is exposed through a V2 file component', () => {
  const message = ticketMessage('Closed', 'Transcript saved.', {attachmentName:'ticket-123.txt'});
  const file = message.components[0].toJSON().components[1];
  assert.equal(file.type, ComponentType.File);
  assert.equal(file.file.url, 'attachment://ticket-123.txt');
});
