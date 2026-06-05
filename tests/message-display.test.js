const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'message-display.js');
const FIXED_NOW = '2026-06-02T14:05:09.000+10:00';
const GREY = '\x1b[90m';
const RESET = '\x1b[0m';

function run(input, extraEnv = {}) {
  return execFileSync('node', [SCRIPT_PATH], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_TIMING_NOW_ISO: FIXED_NOW, ...extraEnv },
    timeout: 5000,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore']
  });
}

test('stamps the first batch (index 0) with the local [HH:MM:SS]', () => {
  const out = run({ index: 0, delta: 'Hello' });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.hookEventName, 'MessageDisplay');
  assert.equal(parsed.hookSpecificOutput.displayContent, `${GREY}[14:05:09]${RESET} Hello`);
});

test('passes later batches (index > 0) through unchanged — no second stamp', () => {
  const out = run({ index: 1, delta: ' world' });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.displayContent, ' world');
});

test('missing delta is treated as empty string', () => {
  const out = run({ index: 0 });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.displayContent, `${GREY}[14:05:09]${RESET} `);
});

test('emits nothing when the surface is disabled', () => {
  const out = run({ index: 0, delta: 'Hello' }, { CLAUDE_TIMING_MESSAGE_DISPLAY: '0' });
  assert.equal(out, '');
});

test('emits nothing when disabled via off/false/no', () => {
  for (const value of ['off', 'false', 'no']) {
    const out = run({ index: 0, delta: 'x' }, { CLAUDE_TIMING_MESSAGE_DISPLAY: value });
    assert.equal(out, '', `expected no output for ${value}`);
  }
});

test('emits bare delta (no [null] prefix) when the clock cannot be derived', () => {
  const out = run({ index: 0, delta: 'Hello' }, { CLAUDE_TIMING_NOW_ISO: 'not-an-iso' });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.displayContent, 'Hello');
});

test('fail-soft on malformed stdin — exit 0, no output (original preserved)', () => {
  // execFileSync throws if the process exits non-zero; this asserts exit 0.
  const out = run('not json at all');
  assert.equal(out, '');
});

test('never alters or echoes anything beyond the displayContent envelope', () => {
  const out = run({ index: 0, delta: 'multi\nline' });
  const parsed = JSON.parse(out);

  assert.deepEqual(Object.keys(parsed), ['hookSpecificOutput']);
  assert.equal(parsed.hookSpecificOutput.displayContent, `${GREY}[14:05:09]${RESET} multi\nline`);
});

test('colours only the marker grey by default; the delta is never wrapped', () => {
  const out = run({ index: 0, delta: 'Hello' });
  const { displayContent } = JSON.parse(out).hookSpecificOutput;

  // Exactly one open code + one reset, and the reset comes before the delta.
  assert.equal(displayContent, `${GREY}[14:05:09]${RESET} Hello`);
  assert.equal(displayContent.indexOf(RESET) < displayContent.indexOf('Hello'), true);
  assert.equal(displayContent.split(GREY).length - 1, 1);
  assert.equal(displayContent.split(RESET).length - 1, 1);
});

test('honours a named colour override (cyan → 36)', () => {
  const out = run({ index: 0, delta: 'Hi' }, { CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'cyan' });
  assert.equal(JSON.parse(out).hookSpecificOutput.displayContent, '\x1b[36m[14:05:09]\x1b[0m Hi');
});

test('honours a raw SGR override (1;90 → bold grey)', () => {
  const out = run({ index: 0, delta: 'Hi' }, { CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: '1;90' });
  assert.equal(JSON.parse(out).hookSpecificOutput.displayContent, '\x1b[1;90m[14:05:09]\x1b[0m Hi');
});

test('none/off/plain disables colour — bare marker, no escape codes', () => {
  for (const value of ['none', 'off', 'plain']) {
    const out = run({ index: 0, delta: 'Hi' }, { CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: value });
    assert.equal(
      JSON.parse(out).hookSpecificOutput.displayContent,
      '[14:05:09] Hi',
      `expected plain marker for ${value}`
    );
  }
});

test('unknown colour value falls back to default grey (never breaks)', () => {
  const out = run({ index: 0, delta: 'Hi' }, { CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR: 'chartreuse' });
  assert.equal(JSON.parse(out).hookSpecificOutput.displayContent, `${GREY}[14:05:09]${RESET} Hi`);
});
