const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const userPromptScriptPath = path.join(rootDir, 'scripts', 'user-prompt-submit.js');
const stopScriptPath = path.join(rootDir, 'scripts', 'stop.js');
const DEFAULT_TIMEOUT_MS = 5000;

test('runNode rejects when a child process exceeds the timeout', async () => {
  await assert.rejects(
    runNode({
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 100
    }),
    /timed out after 100ms/
  );
});

function runScript(scriptPath, { input, dataDir, nowIso }) {
  return runNode({
    args: [scriptPath],
    cwd: rootDir,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_TIMING_NOW_ISO: nowIso
    },
    input: JSON.stringify(input)
  });
}

function runNode({ args, cwd = rootDir, env = process.env, input = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`child process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(input);
  });
}

function runUserPromptSubmit(options) {
  return runScript(userPromptScriptPath, options);
}

function runStop(options) {
  return runScript(stopScriptPath, options);
}

function parseHookOutput(stdout) {
  return JSON.parse(stdout);
}

test('prompt, stop, then prompt includes idle and prior execution timing context', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-integration-'));
  const sessionId = 'session-1';

  const firstPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:00.000+10:00'
  });

  assert.equal(firstPrompt.code, 0, `expected success, stderr was: ${firstPrompt.stderr}`);
  assert.equal(firstPrompt.stderr, '');

  const stopResult = await runStop({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:04.321+10:00'
  });

  assert.equal(stopResult.code, 0, `expected success, stderr was: ${stopResult.stderr}`);
  assert.equal(stopResult.stderr, '');

  const secondPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:19.211+10:00'
  });

  assert.equal(secondPrompt.code, 0, `expected success, stderr was: ${secondPrompt.stderr}`);
  assert.equal(secondPrompt.stderr, '');
  assert.deepEqual(parseHookOutput(secondPrompt.stdout), {
    systemMessage: '[after 14s]',
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: [
        '[timing]',
        'time=2026-04-13T05:00:19+10:00',
        'idle_for=14.9s',
        'last_turn=4.3s',
        '[/timing]'
      ].join('\n')
    }
  });
});

test('prompt, stop, prompt, stop, then prompt reports the second turn execution duration', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-integration-'));
  const sessionId = 'session-1';

  const firstPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:00.000+10:00'
  });

  assert.equal(firstPrompt.code, 0, `expected success, stderr was: ${firstPrompt.stderr}`);
  assert.equal(firstPrompt.stderr, '');

  const firstStop = await runStop({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:04.321+10:00'
  });

  assert.equal(firstStop.code, 0, `expected success, stderr was: ${firstStop.stderr}`);
  assert.equal(firstStop.stderr, '');

  const secondPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:19.211+10:00'
  });

  assert.equal(secondPrompt.code, 0, `expected success, stderr was: ${secondPrompt.stderr}`);
  assert.equal(secondPrompt.stderr, '');

  const secondStop = await runStop({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:27.654+10:00'
  });

  assert.equal(secondStop.code, 0, `expected success, stderr was: ${secondStop.stderr}`);
  assert.equal(secondStop.stderr, '');

  const thirdPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:01:00.000+10:00'
  });

  assert.equal(thirdPrompt.code, 0, `expected success, stderr was: ${thirdPrompt.stderr}`);
  assert.equal(thirdPrompt.stderr, '');
  assert.deepEqual(parseHookOutput(thirdPrompt.stdout), {
    systemMessage: '[after 32s]',
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: [
        '[timing]',
        'time=2026-04-13T05:01:00+10:00',
        'idle_for=32.3s',
        'last_turn=8.4s',
        '[/timing]'
      ].join('\n')
    }
  });
});

test('prompt after more than one idle minute includes a visible TUI system message', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-integration-'));
  const sessionId = 'session-1';

  const firstPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:00.000+10:00'
  });

  assert.equal(firstPrompt.code, 0, `expected success, stderr was: ${firstPrompt.stderr}`);
  assert.equal(firstPrompt.stderr, '');

  const stopResult = await runStop({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:00:04.321+10:00'
  });

  assert.equal(stopResult.code, 0, `expected success, stderr was: ${stopResult.stderr}`);
  assert.equal(stopResult.stderr, '');

  const secondPrompt = await runUserPromptSubmit({
    input: { session_id: sessionId },
    dataDir,
    nowIso: '2026-04-13T05:05:06.321+10:00'
  });

  assert.equal(secondPrompt.code, 0, `expected success, stderr was: ${secondPrompt.stderr}`);
  assert.equal(secondPrompt.stderr, '');
  assert.deepEqual(parseHookOutput(secondPrompt.stdout), {
    systemMessage: '[after 5m 2s]',
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: [
        '[timing]',
        'time=2026-04-13T05:05:06+10:00',
        'idle_for=302.0s',
        'last_turn=4.3s',
        '[/timing]'
      ].join('\n')
    }
  });
});
