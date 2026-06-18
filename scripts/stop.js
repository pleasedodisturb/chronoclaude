#!/usr/bin/env node

const { loadSessionState, saveSessionState } = require('../src/state');
const { getNowIso, diffMs, clockFromIso } = require('../src/time');
const { formatStopTimestamp } = require('../src/format');
const { isEnabled } = require('../src/config');

async function readStdin() {
  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

async function main() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;

  if (!dataDir) {
    throw new Error('CLAUDE_PLUGIN_DATA is required');
  }

  const rawInput = await readStdin();
  const hookInput = JSON.parse(rawInput || '{}');
  const sessionId = hookInput.session_id;

  if (!sessionId) {
    throw new Error('session_id is required');
  }

  const lastStopAt = getNowIso();
  const session = await loadSessionState({ dataDir, sessionId });
  const lastTurnExecMs = session.lastStopAt ? null : diffMs(lastStopAt, session.lastUserPromptAt);

  const nextState = {
    ...session,
    lastStopAt,
    lastAssistantMessageAt: lastStopAt
  };

  if (typeof lastTurnExecMs === 'number') {
    nextState.lastTurnExecMs = lastTurnExecMs;
  }

  await saveSessionState({
    dataDir,
    sessionId,
    state: nextState
  });

  // State above is persisted unconditionally — it underpins every surface.
  // The toggle gates only the emitted output. `stopTimestamp` is opt-in
  // (default off): it surfaces a per-turn `[HH:MM:SS]` note via `systemMessage`
  // for IDE-extension panels (VSCode/JetBrains) where the inline MessageDisplay
  // marker never fires. Off by default so the terminal TUI — which already
  // shows the inline marker — isn't double-stamped.
  if (isEnabled('stopTimestamp')) {
    const systemMessage = formatStopTimestamp(clockFromIso(lastStopAt));

    if (systemMessage) {
      process.stdout.write(JSON.stringify({ systemMessage }));
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error.message}\n`);
  process.exit(0);
});
