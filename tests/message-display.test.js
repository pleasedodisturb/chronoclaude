const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'message-display.js');
const FIXED_NOW = '2026-06-02T14:05:09.000+10:00';

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
  assert.equal(parsed.hookSpecificOutput.displayContent, '[14:05:09] Hello');
});

test('passes later batches (index > 0) through unchanged — no second stamp', () => {
  const out = run({ index: 1, delta: ' world' });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.displayContent, ' world');
});

test('missing delta is treated as empty string', () => {
  const out = run({ index: 0 });
  const parsed = JSON.parse(out);

  assert.equal(parsed.hookSpecificOutput.displayContent, '[14:05:09] ');
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
  assert.equal(parsed.hookSpecificOutput.displayContent, '[14:05:09] multi\nline');
});
