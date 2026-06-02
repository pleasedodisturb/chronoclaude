const test = require('node:test');
const assert = require('node:assert/strict');
const { isEnabled, SURFACES } = require('../src/config');

test('isEnabled defaults to true when the env var is unset', () => {
  assert.equal(isEnabled('passive', {}), true);
  assert.equal(isEnabled('messageDisplay', {}), true);
});

test('isEnabled treats empty string as unset (on)', () => {
  assert.equal(isEnabled('passive', { CLAUDE_TIMING_PASSIVE: '' }), true);
});

test('isEnabled is false only for explicit falsy values (case-insensitive, trimmed)', () => {
  for (const value of ['0', 'false', 'off', 'no', 'FALSE', ' Off ', 'NO']) {
    assert.equal(
      isEnabled('passive', { CLAUDE_TIMING_PASSIVE: value }),
      false,
      `expected off for ${JSON.stringify(value)}`
    );
  }
});

test('isEnabled is true for any non-falsy value', () => {
  for (const value of ['1', 'true', 'on', 'yes', 'enabled']) {
    assert.equal(
      isEnabled('idleNote', { CLAUDE_TIMING_IDLE_NOTE: value }),
      true,
      `expected on for ${JSON.stringify(value)}`
    );
  }
});

test('isEnabled returns true for an unknown surface key (never silently suppress)', () => {
  assert.equal(isEnabled('does-not-exist', { ANYTHING: '0' }), true);
});

test('SURFACES maps the four surfaces to CLAUDE_TIMING_* variables', () => {
  assert.deepEqual(
    Object.keys(SURFACES).sort(),
    ['idleNote', 'messageDisplay', 'passive', 'timeline']
  );

  for (const varName of Object.values(SURFACES)) {
    assert.match(varName, /^CLAUDE_TIMING_/);
  }
});
