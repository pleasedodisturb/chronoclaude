const test = require('node:test');
const assert = require('node:assert/strict');
const { clockFromIso } = require('../src/time');

test('clockFromIso extracts HH:MM:SS from a local ISO with offset', () => {
  assert.equal(clockFromIso('2026-06-02T14:05:09.123+10:00'), '14:05:09');
});

test('clockFromIso extracts HH:MM:SS from a UTC ISO', () => {
  assert.equal(clockFromIso('2026-06-02T14:05:09Z'), '14:05:09');
});

test('clockFromIso returns null for non-ISO / missing input', () => {
  assert.equal(clockFromIso('not a date'), null);
  assert.equal(clockFromIso(''), null);
  assert.equal(clockFromIso(undefined), null);
  assert.equal(clockFromIso(null), null);
});
