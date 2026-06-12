const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const fragmentScriptPath = path.join(rootDir, 'scripts', 'statusline-fragment.js');
const DEFAULT_TIMEOUT_MS = 5000;

function runFragment({ input = '', args = [], dataDir, nowIso, extraEnv = {} } = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CLAUDE_TIMING_NOW_ISO: nowIso,
      ...extraEnv
    };

    if (dataDir !== undefined) {
      env.CLAUDE_PLUGIN_DATA = dataDir;
    } else {
      delete env.CLAUDE_PLUGIN_DATA;
    }

    const child = spawn(process.execPath, [fragmentScriptPath, ...args], {
      cwd: rootDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`fragment timed out after ${DEFAULT_TIMEOUT_MS}ms`));
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(input);
  });
}

function seedSessionState(dataDir, sessionId, state) {
  const sessionsDir = path.join(dataDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const filePath = path.join(sessionsDir, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ sessionId, ...state }, null, 2));
}

test('fragment prints elapsed time since lastStopAt from stdin session_id', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-1';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: '2026-04-12T19:00:00.000Z'
  });

  const result = await runFragment({
    input: JSON.stringify({ session_id: sessionId }),
    dataDir,
    nowIso: '2026-04-12T19:00:45.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '45s');
});

test('fragment prints empty when session has no lastStopAt yet', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-1';

  seedSessionState(dataDir, sessionId, {
    lastUserPromptAt: '2026-04-12T19:00:00.000Z'
  });

  const result = await runFragment({
    input: JSON.stringify({ session_id: sessionId }),
    dataDir,
    nowIso: '2026-04-12T19:00:05.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
});

test('fragment prints empty when no state file exists for the session', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'never-seen' }),
    dataDir,
    nowIso: '2026-04-12T19:00:05.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
});

test('fragment prints empty when stdin is not valid JSON and no --session-id', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));

  const result = await runFragment({
    input: 'not json',
    dataDir,
    nowIso: '2026-04-12T19:00:05.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
});

test('fragment uses --session-id when stdin is empty', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-2';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: '2026-04-12T19:00:00.000Z'
  });

  const result = await runFragment({
    input: '',
    args: ['--session-id', sessionId],
    dataDir,
    nowIso: '2026-04-12T19:03:30.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '3m 30s');
});

test('fragment --session-id overrides stdin session_id', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));

  seedSessionState(dataDir, 'from-arg', {
    lastStopAt: '2026-04-12T19:00:00.000Z'
  });
  seedSessionState(dataDir, 'from-stdin', {
    lastStopAt: '2026-04-12T18:00:00.000Z'
  });

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'from-stdin' }),
    args: ['--session-id', 'from-arg'],
    dataDir,
    nowIso: '2026-04-12T19:00:10.000Z'
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '10s');
});

test('fragment honors --drop-seconds-after flag', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-1';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: '2026-04-12T19:00:00.000Z'
  });

  const withDefault = await runFragment({
    input: JSON.stringify({ session_id: sessionId }),
    dataDir,
    nowIso: '2026-04-12T19:01:00.000Z'
  });
  assert.equal(withDefault.stdout, '1m 0s');

  const withLowerThreshold = await runFragment({
    input: JSON.stringify({ session_id: sessionId }),
    args: ['--drop-seconds-after', '30'],
    dataDir,
    nowIso: '2026-04-12T19:01:00.000Z'
  });
  assert.equal(withLowerThreshold.stdout, '1m');
});

test('fragment prints empty when CLAUDE_PLUGIN_DATA is not set', async () => {
  const result = await runFragment({
    input: JSON.stringify({ session_id: 'session-1' }),
    dataDir: undefined,
    nowIso: '2026-04-12T19:00:05.000Z',
    extraEnv: { CLAUDE_PLUGIN_DATA: '' }
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
});

test('fragment captures model on first tick after a stop', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-model-capture';
  const stopAt = '2026-04-12T19:00:00.000Z';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: stopAt
  });

  const result = await runFragment({
    input: JSON.stringify({
      session_id: sessionId,
      model: { id: 'claude-opus-4-7' }
    }),
    dataDir,
    nowIso: '2026-04-12T19:00:10.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '10s');

  const saved = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'sessions', `${sessionId}.json`), 'utf8')
  );
  assert.equal(saved.modelAtLastStop, 'claude-opus-4-7');
  assert.equal(saved.modelAtLastStopAt, stopAt);
});

test('fragment prints --- when model changed since capture', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-model-changed';
  const stopAt = '2026-04-12T19:00:00.000Z';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: stopAt,
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: stopAt
  });

  const result = await runFragment({
    input: JSON.stringify({
      session_id: sessionId,
      model: { id: 'claude-opus-4-7' }
    }),
    dataDir,
    nowIso: '2026-04-12T19:00:30.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '---');
});

test('fragment shows elapsed time when current model matches captured model', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-model-same';
  const stopAt = '2026-04-12T19:00:00.000Z';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: stopAt,
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: stopAt
  });

  const result = await runFragment({
    input: JSON.stringify({
      session_id: sessionId,
      model: { id: 'claude-sonnet-4-6' }
    }),
    dataDir,
    nowIso: '2026-04-12T19:00:15.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '15s');
});

test('fragment re-captures model when a newer lastStopAt is seen', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-model-recapture';
  const newerStopAt = '2026-04-12T19:00:00.000Z';
  const olderStopAt = '2026-04-12T18:00:00.000Z';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: newerStopAt,
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: olderStopAt
  });

  const result = await runFragment({
    input: JSON.stringify({
      session_id: sessionId,
      model: { id: 'claude-opus-4-7' }
    }),
    dataDir,
    nowIso: '2026-04-12T19:00:20.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '20s');

  const saved = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'sessions', `${sessionId}.json`), 'utf8')
  );
  assert.equal(saved.modelAtLastStop, 'claude-opus-4-7');
  assert.equal(saved.modelAtLastStopAt, newerStopAt);
});

test('fragment --model-id flag overrides stdin model', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-model-flag';
  const stopAt = '2026-04-12T19:00:00.000Z';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: stopAt,
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: stopAt
  });

  const result = await runFragment({
    input: JSON.stringify({
      session_id: sessionId,
      model: { id: 'claude-sonnet-4-6' }
    }),
    args: ['--model-id', 'claude-opus-4-7'],
    dataDir,
    nowIso: '2026-04-12T19:00:05.000Z'
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '---');
});

test('fragment --clock prepends current HH:MM before the elapsed timer', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  seedSessionState(dataDir, 'clock-1', { lastStopAt: '2026-04-12T19:00:00.000Z' });

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'clock-1' }),
    args: ['--clock'],
    dataDir,
    nowIso: '2026-04-12T19:00:45.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '19:00 45s');
});

test('fragment --clock-position after puts the clock after the elapsed timer', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  seedSessionState(dataDir, 'clock-2', { lastStopAt: '2026-04-12T19:00:00.000Z' });

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'clock-2' }),
    args: ['--clock', '--clock-position', 'after'],
    dataDir,
    nowIso: '2026-04-12T19:00:45.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '45s 19:00');
});

test('fragment --clock renders the clock even with no session / data dir (elapsed empty)', async () => {
  const result = await runFragment({
    input: '',
    args: ['--clock'],
    dataDir: undefined,
    nowIso: '2026-04-12T19:00:45.000Z',
    extraEnv: { CLAUDE_PLUGIN_DATA: '' }
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '19:00');
});

test('fragment --clock renders alongside --- on a model change', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const stopAt = '2026-04-12T19:00:00.000Z';
  seedSessionState(dataDir, 'clock-3', {
    lastStopAt: stopAt,
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: stopAt
  });

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'clock-3', model: { id: 'claude-opus-4-7' } }),
    args: ['--clock'],
    dataDir,
    nowIso: '2026-04-12T19:00:30.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '19:00 ---');
});

test('fragment without --clock is unchanged (elapsed only)', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  seedSessionState(dataDir, 'clock-off', { lastStopAt: '2026-04-12T19:00:00.000Z' });

  const result = await runFragment({
    input: JSON.stringify({ session_id: 'clock-off' }),
    dataDir,
    nowIso: '2026-04-12T19:00:45.000Z'
  });

  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '45s');
});

test('fragment ignores model tracking when no model id is available', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-fragment-'));
  const sessionId = 'session-no-model';

  seedSessionState(dataDir, sessionId, {
    lastStopAt: '2026-04-12T19:00:00.000Z',
    modelAtLastStop: 'claude-sonnet-4-6',
    modelAtLastStopAt: '2026-04-12T19:00:00.000Z'
  });

  const result = await runFragment({
    input: JSON.stringify({ session_id: sessionId }),
    dataDir,
    nowIso: '2026-04-12T19:00:05.000Z'
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '5s');
});
