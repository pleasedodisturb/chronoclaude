const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isEnabled,
  SURFACES,
  terminalSupportsAnsi,
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

test('SURFACES maps the four surfaces to CLAUDE_TIMING_* variables', () => {
  assert.deepEqual(
    Object.keys(SURFACES).sort(),
    ['idleNote', 'messageDisplay', 'passive', 'timeline']
  );

  for (const varName of Object.values(SURFACES)) {
    assert.match(varName, /^CLAUDE_TIMING_/);
  }
});

test('terminalSupportsAnsi is true for the cli entrypoint and when unset', () => {
  assert.equal(terminalSupportsAnsi({ CLAUDE_CODE_ENTRYPOINT: 'cli' }), true);
  assert.equal(terminalSupportsAnsi({ CLAUDE_CODE_ENTRYPOINT: 'CLI' }), true);
  assert.equal(terminalSupportsAnsi({}), true);
  assert.equal(terminalSupportsAnsi({ CLAUDE_CODE_ENTRYPOINT: '' }), true);
});

test('terminalSupportsAnsi is false for GUI/remote entrypoints (no ANSI in panel)', () => {
  for (const entrypoint of ['claude-vscode', 'remote', 'remote_mobile', 'mcp', 'claude-in-teams']) {
    assert.equal(
      terminalSupportsAnsi({ CLAUDE_CODE_ENTRYPOINT: entrypoint }),
      false,
      `expected no ANSI for ${entrypoint}`
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
