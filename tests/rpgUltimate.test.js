'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
const commands = require('../src/rpg/commands');
const catalog = require('../src/rpg/help/catalog');
const { helpView } = require('../src/rpg/ui/help');
const { renderMeme } = require('../src/rpg/ui/memes');
const formulas = require('../src/rpg/utils/formulas');
const { safeMath } = require('../src/rpg/commands/utility');
const { parse } = require('../src/rpg/handler');

const REQUIRED = [
  'ttop', 'tmy',
  'tcash', 'tgive', 'tdaily', 'tweekly', 'tmonthly', 'twork', 'tvote', 'tquest', 'tchecklist', 'tshop', 'tbuy', 'tsell',
  'tzoo', 'thunt', 'tsacrifice', 'tbattle', 'tsim', 'tinv', 'tequip', 'tautohunt', 'tdex', 'tlootbox', 'tegg', 'tcrate', 'tteam', 'tweapon', 'trename', 'tdismantle', 'tboss', 'tpet',
  'tslots', 'tcoinflip', 'tlottery', 'tblackjack', 'tdice', 'troulette', 'tguess', 'ttrivia', 'trps',
  't8ball', 'tdefine', 'tgif', 'tpic', 'ttranslate', 'troll', 'tchoose', 'tbell',
  'tcookie', 'tship', 'tpray', 'tcurse', 'tmarry', 'temoji', 'tprofile', 'tlevel', 'twallpaper', 'tgodify', 'tavatar',
  'tspongebobchicken', 'tslapcar', 'tisthisa', 'tdrake', 'tdistractedbf', 'tcommunismcat', 'teject', 'temergencymeeting', 'theadpat', 'ttradeoffer', 'twaddle',
  'tblush', 'tcry', 'tdance', 'tpout', 'tshrug', 'tsleepy', 'tsmile', 'tsmug', 'tthumbsup', 'twag', 'tthinking', 'ttriggered', 'tteehee', 'tderedere', 'tthonsking', 'tscoff', 'thappy', 'tthumbs', 'tgrin',
  'tcuddle', 'thug', 'tkiss', 'tlick', 'tnom', 'tpat', 'tpoke', 'tslap', 'tstare', 'thighfive', 'tbite', 'tgreet', 'tpunch', 'thandholding', 'ttickle', 'thold', 'tpats', 'twave', 'tboop', 'tsnuggle', 'tbully',
  'tping', 'tstats', 'tlink', 'tguildlink', 'tdisable', 'tcensor', 'tpatron', 'tannouncement', 'trules', 'tsuggest', 'tshards', 'tmath', 'tcolor', 'tprefix',
];

test('every command in the screenshot command list is registered and documented', () => {
  for (const name of REQUIRED) assert.ok(commands.get(name), `${name} harus terdaftar`);
  for (const name of REQUIRED) assert.ok(catalog.getEntry(name), `${name} harus punya help`);
});

test('every command displayed in every help category exists in the registry', () => {
  for (const category of catalog.CATEGORIES) {
    for (const bare of catalog.commandsFor(category)) {
      assert.ok(commands.get(`t${bare}`), `kategori ${category.label} menampilkan ${bare} yang tidak ada`);
    }
  }
});

test('help overview is the 666 command list with all ten categories', () => {
  const data = helpView().embeds[0].data;
  assert.equal(data.title, 'Command List');
  assert.match(data.description, /Here is the list of commands!/);
  assert.match(data.description, /thelp \{command\}/);
  assert.match(data.description, /Need more help\? Come join our guild/);
  assert.equal(data.fields.length, 10);
  const names = data.fields.map((field) => field.name.replace(/\*/g, ''));
  for (const label of ['🏅 Rankings', '💰 Economy', '🌱 Animals', '🎲 Gambling', '🎱 Fun', '🎭 Social', '😂 Meme', '🙂 Emotes', '🤗 Actions', '🔧 Utility']) {
    assert.ok(names.includes(label), `kategori ${label} hilang`);
  }
  for (const field of data.fields) assert.ok(field.value.length <= 1024);
});

test('per-command help exposes usage, cooldown, permission, and aliases', () => {
  const data = helpView('daily').embeds[0].data;
  assert.equal(data.title, '📖 tdaily');
  const names = data.fields.map((field) => field.name);
  assert.ok(names.includes('📌 Usage'));
  assert.ok(names.includes('⏱️ Cooldown'));
  assert.ok(names.includes('🔐 Permission'));
  const profile = helpView('profile').embeds[0].data;
  assert.match(profile.fields.find((f) => f.name === '🔗 Aliases').value, /tme/);
});

test('custom prefix parsing keeps t and adds a server prefix', () => {
  assert.equal(parse('tcash daily').token, 'tcash');
  assert.equal(parse('ttop').token, 'ttop');
  assert.equal(parse('!cash daily', '!').token, 'tcash');
  assert.deepEqual(parse('!give @x 5', '!').args, ['@x', '5']);
  assert.equal(parse('!cash', 't'), null);
  assert.equal(parse('6cash daily'), null);
});

test('safe math parser evaluates without eval and rejects code', () => {
  assert.equal(safeMath('(12+3)*4'), 60);
  assert.equal(safeMath('2^3^2'), 512);
  assert.throws(() => safeMath('process.exit(1)'), /Ekspresi/);
  assert.throws(() => safeMath('1/0'), /nol/);
});

test('equipped weapon adds battle stats', () => {
  const base = formulas.playerBattleStats({ level: 1 }, [], {});
  const armed = formulas.playerBattleStats({ level: 1, equippedWeapon: { attack: 18, defense: 3, speed: 2 } }, [], {});
  assert.equal(armed.attack, base.attack + 18);
  assert.equal(armed.defense, base.defense + 3);
  assert.equal(armed.speed, base.speed + 2);
});

test('meme engine renders a real PNG for every template', async () => {
  for (const template of Object.keys(require('../src/rpg/ui/memes').TEMPLATES)) {
    const buffer = await renderMeme(template, ['baris satu', 'baris dua'], { username: 'tester' });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10_000);
    assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  }
});

test('social, sacrifice, lootbox, lottery, and server config work on the data layer', async () => {
  const userService = require('../src/rpg/services/userService');
  const extra = require('../src/rpg/services/extraService');
  const serverConfig = require('../src/rpg/services/serverConfigService');
  const guildId = '123456789012345678';
  const userId = '223456789012345678';
  await models.RPGUser.create({ guildId, userId, wallet: 10000 });
  await models.RPGUser.create({ guildId, userId: '323456789012345678', wallet: 0 });

  const vote = await extra.vote(guildId, userId);
  assert.equal(vote.reward, 250);

  const monster = await models.Monster.create({ guildId, userId, speciesId: 'slime', name: 'Slime', rarity: 'common', sellValue: 100 });
  const sacrifice = await extra.sacrifice(guildId, userId, String(monster._id));
  assert.ok(sacrifice.coins >= 10);
  assert.equal(await models.Monster.countDocuments({ guildId, userId }), 0);

  const box = await extra.openLootbox(guildId, userId, 'lootbox');
  assert.ok(['coins', 'shards', 'item', 'egg'].includes(box.type));

  const round = await extra.lotteryStatus(guildId);
  const ticket = await extra.buyLottery(guildId, userId, 1);
  assert.equal(ticket.tickets, 1);
  assert.ok(ticket.round.pot >= round.ticketPrice);
  await models.Lottery.updateOne({ _id: round._id }, { $set: { endsAt: new Date(Date.now() - 1000) } });
  const draw = await extra.drawLottery(guildId);
  assert.equal(draw.winnerId, userId);

  const disabled = await serverConfig.toggleCommand(guildId, 'hunt', false);
  assert.equal(disabled.enabled, false);
  assert.equal(await serverConfig.isCommandEnabled(guildId, 'hunt'), false);
  const enabled = await serverConfig.toggleCommand(guildId, 'hunt', true);
  assert.equal(enabled.enabled, true);

  await serverConfig.setCensor(guildId, true);
  await serverConfig.addCensoredWord(guildId, 'badword');
  assert.equal(await serverConfig.findCensored(guildId, 'this is a badword!'), 'badword');
  assert.equal(await serverConfig.findCensored(guildId, 'this is fine'), null);

  const social = await userService.ensureUser(guildId, userId);
  assert.ok(social.wallet > 0);
});
