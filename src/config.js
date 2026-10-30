import { readFileSync } from 'node:fs';
export const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
export function validateConfig() {
  const ids = [...config.ranks.map(r=>r.roleId), ...Object.values(config.categories), ...Object.values(config.pingRoles), config.panelChannelId];
  if (ids.some(id => !/^\d{17,20}$/.test(id))) throw new Error('Fill all rank, category, ping role, and panel channel IDs in config.json.');
  const keys = ['administration','supervisor','internalAffairs','iaSupervisor','iaDirectives','management','seniorManagement','directives','ownership'];
  if (keys.some(k => !config.ranks.some(r=>r.key===k))) throw new Error('Missing required rank key.');
  if (new Set(config.ranks.map(r=>r.roleId)).size !== config.ranks.length) throw new Error('Rank role IDs must be unique.');
}
