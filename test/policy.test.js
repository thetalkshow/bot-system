import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memberRank, canSpeak, canEscalate, escalationOptions, status } from '../src/policy.js';
const config=JSON.parse(readFileSync(new URL('../config.example.json',import.meta.url)));
config.ranks.forEach(r=>r.roleId=r.key);
const member=(id,...roles)=>({id,roles:{cache:new Map(roles.map(r=>[r,{}]))}});
test('highest configured rank wins for members with several roles',()=>{
  assert.equal(memberRank(config,member('a','administration','management')),5);
});
test('claimed ticket silences equal and lower ranks, permits higher ranks',()=>{
  const t={minimum:'administration',claimedBy:'a',claimRank:0};
  assert.equal(canSpeak(config,t,0),false);
  assert.equal(canSpeak(config,t,1),true);
  assert.equal(canSpeak(config,{...t,claimRank:5},4),false);
});
test('claimant or supervisor can escalate, unauthorized staff cannot',()=>{
  const t={type:'general',minimum:'administration',claimedBy:'a'};
  assert.equal(canEscalate(config,t,member('a','administration')),true);
  assert.equal(canEscalate(config,t,member('b','administration')),false);
  assert.equal(canEscalate(config,t,member('b','supervisor')),true);
  assert.equal(canEscalate(config,{...t,ownership:true},member('b','ownership')),false);
});
test('destinations follow ticket type and only move upward',()=>{
  assert.deepEqual(escalationOptions(config,{type:'general',minimum:'administration'}),['supervisor','internalAffairs','management']);
  assert.deepEqual(escalationOptions(config,{type:'shr',minimum:'seniorManagement'}),['directives','ownership']);
  assert.deepEqual(escalationOptions(config,{type:'ia',minimum:'management'}),['seniorManagement','directives']);
});
test('ownership blocks all non-ownership ranks',()=>{
  const t={ownership:true,minimum:'ownership'};
  for(let rank=0;rank<8;rank++) assert.equal(canSpeak(config,t,rank),false);
  assert.equal(canSpeak(config,t,8),true);
});
test('response status changes only after one hour and escalations take priority',()=>{
  const t={claimedBy:'a',lastUserAt:1000,lastStaffAt:0};
  assert.equal(status({...t,claimedBy:null},3601000),'🔴');
  assert.equal(status(t,3600999),'🟢');
  assert.equal(status(t,3601000),'🟡');
  assert.equal(status({...t,lastStaffAt:2000},3601000),'🟢');
  assert.equal(status({...t,escalated:true},3601000),'🔵');
  assert.equal(status({...t,ownership:true},3601000),'⚫');
});
