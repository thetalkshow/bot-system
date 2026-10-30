import { ContainerBuilder, TextDisplayBuilder, FileBuilder, MessageFlags } from 'discord.js';

// Components V2 cannot be combined with legacy content or embeds.
export function ticketMessage(title, description, { actions = [], pingRoleId, attachmentName } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${description}`));
  if (attachmentName) container.addFileComponents(new FileBuilder().setURL(`attachment://${attachmentName}`));
  if (actions.length) container.addActionRowComponents(...actions);
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      ...(pingRoleId ? [new TextDisplayBuilder().setContent(`<@&${pingRoleId}>`)] : []),
      container
    ],
    allowedMentions: { parse: [], roles: pingRoleId ? [pingRoleId] : [] }
  };
}
