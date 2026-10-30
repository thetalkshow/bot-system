import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
const directory = new URL('../data/', import.meta.url);
const file = new URL('tickets.json', directory);
mkdirSync(directory, {recursive:true});
export let tickets;
try { tickets = JSON.parse(readFileSync(file, 'utf8')); }
catch (error) { if(error.code !== 'ENOENT') throw error; tickets = {}; }
export function save() {
  const temporary = new URL('tickets.json.tmp', directory);
  writeFileSync(temporary, JSON.stringify(tickets, null, 2), {mode:0o600});
  renameSync(temporary, file);
}
