export const TYPES = {
  general: { name: 'General Support', minimum: 'administration', escalations: ['supervisor','internalAffairs','management'] },
  report: { name: 'Reports', minimum: 'supervisor', escalations: ['supervisor','iaSupervisor','iaDirectives','management','seniorManagement','directives'] },
  ia: { name: 'Internal Affairs', minimum: 'internalAffairs', escalations: ['iaSupervisor','iaDirectives','management','seniorManagement','directives'] },
  shr: { name: 'SHR Support', minimum: 'management', escalations: ['seniorManagement','directives','ownership'] }
};
export const rankIndex = (config, key) => config.ranks.findIndex(r => r.key === key);
export function memberRank(config, member) {
  return config.ranks.reduce((highest, r, i) => member.roles.cache.has(r.roleId) ? i : highest, -1);
}
export function canEscalate(config, ticket, member) {
  const rank = memberRank(config, member);
  return !ticket.closed && !ticket.ownership && rank >= rankIndex(config, ticket.minimum) &&
    (ticket.claimedBy === member.id || rank >= rankIndex(config, 'supervisor'));
}
export function escalationOptions(config, ticket) {
  return TYPES[ticket.type].escalations.filter(key => rankIndex(config, key) > rankIndex(config, ticket.minimum));
}
export function status(ticket, now = Date.now()) {
  if (ticket.ownership) return '⚫';
  if (ticket.escalated) return '🔵';
  if (!ticket.claimedBy) return '🔴';
  if (ticket.lastUserAt > (ticket.lastStaffAt || 0) && now - (ticket.pendingSince || ticket.lastUserAt) >= 3600000) return '🟡';
  return '🟢';
}
export function canSpeak(config, ticket, rank) {
  if (ticket.ownership) return rank >= rankIndex(config, 'ownership');
  return rank >= rankIndex(config, ticket.minimum) && (!ticket.claimedBy || rank > ticket.claimRank);
}
