'use strict';

const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../src/rpg/help/catalog');

const OUT = path.join(__dirname, '..', 'web', 'commands.json');

function stripBackticks(line) {
  return String(line || '').replace(/`/g, '');
}

const payload = {
  name: '666 ULTIMATE RPG',
  tagline: 'TWO MEMBERS. ONE CONNECTION. ONE STREAK.',
  prefix: '6',
  categories: catalog.CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    emoji: category.emoji,
    blurb: category.blurb,
    commands: category.commands.map((rawEntry) => {
      const entry = catalog.describe(rawEntry);
      return {
        name: entry.name,
        aliases: entry.aliases || [],
        summary: entry.summary,
        usage: entry.usage,
        examples: entry.examples || [],
        required: entry.required || [],
        optional: entry.optional || [],
        cooldown: entry.cooldown || null,
        permission: entry.permission || 'Everyone',
        note: entry.note || null,
        subcommands: catalog.linesFor(entry).map(stripBackticks),
      };
    }),
  })),
};

const rendered = `${JSON.stringify(payload, null, 2)}\n`;
const check = process.argv.includes('--check');
if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error('web/commands.json is stale. Run `npm run web:build`.');
    process.exit(1);
  }
  console.log('web/commands.json is up to date.');
} else {
  fs.writeFileSync(OUT, rendered);
  console.log(`Wrote ${OUT} (${payload.categories.length} categories, ${payload.categories.reduce((n, c) => n + c.commands.length, 0)} commands).`);
}
