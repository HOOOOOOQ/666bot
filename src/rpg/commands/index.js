'use strict';

const cash = require('./cash');
const hunting = require('./hunt');
const battle = require('./battle');
const pet = require('./pet');
const quest = require('./quest');
const achievement = require('./achievement');
const rank = require('./rank');
const profile = require('./profile');
const guild = require('./guild');
const boss = require('./boss');
const help = require('./help');
const market = require('./market');
const gameModules = require('./games');

const modules = [cash, hunting, battle, pet, quest, achievement, rank, profile, guild, boss, help, ...market, ...gameModules];
const registry = new Map();

for (const module of modules) {
  for (const name of module.names || []) registry.set(name.toLowerCase(), module);
}

function get(name) {
  return registry.get(String(name || '').toLowerCase()) || null;
}

function list() {
  return [...registry.keys()].sort();
}

module.exports = { registry, get, list, modules };
