'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeDuoName,
  hasMeaningfulContent,
  isLowEffortSpam,
  isUrlOnly,
  isSnowflake,
} = require('../src/utils/validators');
const { UserError } = require('../src/utils/errors');

test('sanitizeDuoName strips mentions and control characters', () => {
  assert.equal(sanitizeDuoName('  Tama  ×  Zen  '), 'Tama × Zen');
  assert.equal(sanitizeDuoName('@everyone Tama × Zen'), 'Tama × Zen');
  assert.equal(sanitizeDuoName('<@123456789012345678> Tama'), 'Tama');
});

test('sanitizeDuoName rejects too short / too long names', () => {
  assert.throws(() => sanitizeDuoName('A'), UserError);
  assert.throws(() => sanitizeDuoName('x'.repeat(40)), UserError);
  assert.throws(() => sanitizeDuoName('@everyone'), UserError);
});

test('hasMeaningfulContent ignores emoji-only, mention-only and short messages', () => {
  assert.equal(hasMeaningfulContent('hi', 3), false);
  assert.equal(hasMeaningfulContent('🔥🔥🔥🔥', 3), false);
  assert.equal(hasMeaningfulContent('<@123456789012345678>', 3), false);
  assert.equal(hasMeaningfulContent('hello world', 3), true);
});

test('low effort spam detection', () => {
  assert.equal(isLowEffortSpam('aaaaaaaaaaaa'), true);
  assert.equal(isLowEffortSpam('lolololololol'), true);
  assert.equal(isLowEffortSpam('asdfasdfasdfasdf'), true);
  assert.equal(isLowEffortSpam('Selamat pagi semuanya!'), false);
});

test('url-only messages do not count', () => {
  assert.equal(isUrlOnly('https://example.com'), true);
  assert.equal(isUrlOnly('cek ini https://example.com'), false);
});

test('snowflake validation', () => {
  assert.equal(isSnowflake('123456789012345678'), true);
  assert.equal(isSnowflake('123'), false);
  assert.equal(isSnowflake('abc'), false);
});
