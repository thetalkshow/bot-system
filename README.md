# Discord ticket bot

Node.js 22+ and discord.js. Ticket state persists in `data/tickets.json`; run one bot process and retain this directory across restarts.

## Setup

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and securely set your bot token, application ID, and server ID. Never commit the token.
3. Copy `config.example.json` to `config.json`. Fill all role/category IDs, the ticket panel channel, and a private transcript channel. Ping roles may be separate from the access rank roles.
4. In the Discord developer portal enable **Message Content Intent**. Invite with `bot` and `applications.commands` scopes. Give the bot View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Manage Channels, and Manage Roles. Position its role above the roles it manages. Avoid Administrator for staff roles if ticket privacy is required.
5. Run `npm run register`, then `npm start`. An administrator with Manage Server can use `/ticket-panel` to post the embedded creation panel.

Run `npm test` for policy tests. Real Discord validation requires your token and IDs: open each ticket type, claim with two equal-ranked accounts, verify higher-ranked access, escalate, test ownership isolation, and close to verify transcript delivery.

## Permissions and workflow

The order of `ranks` in config is the access ladder, lowest to highest. A member's highest configured rank controls authorization. Rank names appear in embeds; access uses the configured role IDs. Default order: Administration, Supervisor, Internal Affairs, IA Supervisor, IA Directives, Management, Senior Management, Directives, Ownership. Confirm this ladder matches your server; parallel IA and administrative tracks would need a different policy.

General pings Administration with Administration+ access. Reports ping Supervision with Supervisor+ access. IA pings Internal Affairs with IA+ access. SHR pings Management with Management+ access. Configure categories as General Support, Reports, Internal Affairs, SHR Support, and Awaiting Ownership.

One open ticket per requester. Claiming lets the claimant and higher ranks speak; equal and lower staff ranks become read-only. The requester can still speak. A claimant or Supervisor+ with ticket access can escalate to the destinations defined for that ticket type, only upward. Every escalation clears the claim and raises the access floor. Ownership moves the channel to Awaiting Ownership and removes requester and other staff access; only Ownership and the bot retain access. Discord Administrator and the server owner inherently bypass channel restrictions.

Names use 🔴 unclaimed, 🟢 claimed/active, 🟡 requester waiting at least one hour since the first unanswered message, 🔵 escalated, ⚫ awaiting ownership, plus ticket type and unique ticket number. Escalation colors take priority. A minute timer updates names; Discord rate limits can delay updates. Staff messages clear the response wait. Higher-rank roles allow sending even if the member also has lower roles.

Requester or eligible staff can close ordinary tickets; only Ownership can close ownership tickets. Closing requires a transcript channel and saves a text transcript before deleting the ticket channel. Transcripts contain message content, embeds, and attachment URLs, not downloaded attachment files. Restrict transcript channel access; Discord upload limits can block closing very large tickets, preserving the channel for manual handling.

Do not add custom per-user channel grants; ticket permission changes replace overwrites. Role/rank changes in a running ticket may require a new claim/escalation to rebuild overwrites. State is local JSON; multi-process hosting and cross-instance coordination are not supported.
