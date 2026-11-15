'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../src/rpg/help/catalog');
const commands = require('../src/rpg/commands');
const { helpView } = require('../src/rpg/ui/help');

test('every registered prefix command has a help entry or alias', () => {
  const missing = commands.list().filter((name) => !catalog.getEntry(name));
  assert.deepEqual(missing, []);
  assert.ok(catalog.ENTRIES.length >= 20);
});

test('help resolves command, category, alias, and keyword queries', () => {
  assert.equal(helpView('cash').embeds[0].data.title, '📖 6cash');
  assert.equal(helpView('6cash').embeds[0].data.title, '📖 6cash');
  assert.match(helpView('economy').embeds[0].data.title, /ECONOMY/);
  assert.equal(helpView('me').embeds[0].data.title, '📖 6profile');
  assert.equal(helpView('daily').embeds[0].data.title, '📖 6daily');
  assert.match(helpView('tidak-ada-command-ini').embeds[0].data.title, /HASIL PENCARIAN/);
  assert.match(helpView('tidak-ada-command-ini').embeds[0].data.description, /Tidak ada command/);
});

test('overview stays inside Discord embed and component limits', () => {
  const view = helpView();
  assert.equal(view.embeds[0].data.fields.length, catalog.CATEGORIES.length);
  assert.ok(view.embeds[0].data.fields.length <= 25);
  for (const field of view.embeds[0].data.fields) {
    assert.ok(field.name.length <= 256);
    assert.ok(field.value.length <= 1024);
  }
  assert.ok(view.components.length <= 5);
  const select = view.components[0].toJSON().components[0];
  assert.equal(select.custom_id, 'rpg:help:select:0');
  assert.equal(select.options.length, catalog.CATEGORIES.length);
  assert.ok(select.options.length <= 25);
});

test('category view lists every command and keeps detail subcommands', () => {
  const games = catalog.getCategory('games');
  const view = helpView('games');
  assert.equal(view.embeds[0].data.fields.length, games.commands.length);
  const cash = helpView('cash').embeds[0].data;
  const details = cash.fields.find((field) => field.name.includes('Subcommand'));
  assert.match(details.value, /6cash daily/);
});

test('slash /help is deployable and help interaction edits the menu', async () => {
  const slash = require('../src/commands/help');
  assert.equal(slash.data.name, 'help');
  const json = slash.data.toJSON();
  assert.equal(json.options[0].name, 'command');

  const captured = [];
  const interaction = {
    isStringSelectMenu: () => true,
    values: ['battle'],
    editReply: async (payload) => captured.push(payload),
  };
  const { handleHelpInteraction } = require('../src/rpg/ui/help');
  await handleHelpInteraction(interaction, 'select');
  assert.equal(captured.length, 1);
  assert.match(captured[0].embeds[0].data.title, /6battle|BATTLE/);
});
