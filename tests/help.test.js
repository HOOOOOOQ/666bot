'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { helpEmbed } = require('../src/ui/embeds');
const { loadCommands } = require('../src/handlers/commandHandler');

test('only /duo and /help are registered', () => {
  const commands = loadCommands();
  assert.deepEqual([...commands.keys()].sort(), ['duo', 'help']);
});

test('the shared help embed only documents Duo Streak commands', () => {
  const embed = helpEmbed().toJSON();
  assert.match(embed.title, /DUO STREAK/);
  assert.match(embed.description, /\/duo invite/);
  assert.match(embed.description, /\/duo streak/);
  assert.match(embed.description, /\/duo setlog/);
  assert.doesNotMatch(embed.description, /tcash|thunt|RPG|dashboard/i);
});

test('slash /help replies with the streak guide', async () => {
  const slash = require('../src/commands/help');
  assert.equal(slash.data.name, 'help');
  assert.match(slash.data.description, /Duo Streak/i);

  const replies = [];
  await slash.execute({
    reply: async (payload) => replies.push(payload),
  });
  assert.equal(replies.length, 1);
  assert.match(replies[0].embeds[0].toJSON().title, /DUO STREAK/);
  assert.equal(replies[0].ephemeral, true);
});
