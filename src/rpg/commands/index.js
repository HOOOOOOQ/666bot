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
const economyShortcuts = require('./economyShortcuts');
const economyExtra = require('./economyExtra');
const animalsExtra = require('./animalsExtra');
const fun = require('./fun');
const social = require('./social');
const meme = require('./meme');
const emotes = require('./emotes');
const lottery = require('./lottery');
const { commands: utilityCommands } = require('./utility');

// Old modules stay first: a legacy alias always wins a name collision so the
// upgrade is strictly additive and never changes existing behaviour.
const legacyModules = [cash, hunting, battle, pet, quest, achievement, rank, profile, guild, boss, help, ...market, ...gameModules];
const newModules = [...economyShortcuts, ...economyExtra, ...animalsExtra, ...fun, ...social, ...meme, ...emotes, ...lottery, ...utilityCommands];
const modules = [...legacyModules, ...newModules];
const registry = new Map();
const meta = new Map();

for (const module of modules) {
  for (const name of module.names || []) {
    const key = name.toLowerCase();
    if (registry.has(key)) continue;
    registry.set(key, module);
    if (module.meta) meta.set(key, module.meta);
  }
}

function get(name) {
  return registry.get(String(name || '').toLowerCase()) || null;
}

function list() {
  return [...registry.keys()].sort();
}

function metaFor(name) {
  return meta.get(String(name || '').toLowerCase()) || null;
}

function allMeta() {
  return [...new Set(meta.values())];
}

module.exports = { registry, get, list, modules, metaFor, allMeta };
