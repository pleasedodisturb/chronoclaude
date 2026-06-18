const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isEnabled,
  SURFACES,
  OPT_IN_SURFACES,
  messageDisplayColorCode
} = require('../src/config');

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

test('SURFACES maps every surface to a CLAUDE_TIMING_* variable', () => {
  assert.deepEqual(
    Object.keys(SURFACES).sort(),
    ['idleNote', 'messageDisplay', 'passive', 'stopTimestamp', 'timeline']
  );

  for (const varName of Object.values(SURFACES)) {
    assert.match(varName, /^CLAUDE_TIMING_/);
  }
});

test('stopTimestamp is the only opt-in (default-off) surface', () => {
  assert.deepEqual([...OPT_IN_SURFACES].sort(), ['stopTimestamp']);
});

test('opt-in surfaces default to OFF when the env var is unset or empty', () => {
  assert.equal(isEnabled('stopTimestamp', {}), false);
  assert.equal(isEnabled('stopTimestamp', { CLAUDE_TIMING_STOP_TIMESTAMP: '' }), false);
});

test('opt-in surfaces turn on ONLY for an explicit truthy value', () => {
  for (const value of ['1', 'true', 'on', 'yes', 'ON', ' Yes ', 'TRUE']) {
    assert.equal(
      isEnabled('stopTimestamp', { CLAUDE_TIMING_STOP_TIMESTAMP: value }),
      true,
      `expected on for ${JSON.stringify(value)}`
    );
  }
});

test('opt-in surfaces stay off for falsy or unrecognized values', () => {
  for (const value of ['0', 'false', 'off', 'no', 'enabled', 'maybe']) {
    assert.equal(
      isEnabled('stopTimestamp', { CLAUDE_TIMING_STOP_TIMESTAMP: value }),
      false,
      `expected off for ${JSON.stringify(value)}`
    );
  }
});

test('messageDisplayColorCode defaults to grey (90) when unset', () => {
  assert.equal(messageDisplayColorCode({}), '90');
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: '' }), '90');
});

test('messageDisplayColorCode maps named colours (case-insensitive)', () => {
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'grey' }), '90');
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'GRAY' }), '90');
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'Cyan' }), '36');
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'dim' }), '2');
});

test('messageDisplayColorCode accepts raw SGR sequences', () => {
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: '90' }), '90');
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: '1;90' }), '1;90');
});

test('messageDisplayColorCode returns null for none/off/plain', () => {
  for (const value of ['none', 'off', 'plain', 'NONE']) {
    assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: value }), null);
  }
});

test('messageDisplayColorCode falls back to grey for unknown values', () => {
  assert.equal(messageDisplayColorCode({ CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'chartreuse' }), '90');
});
