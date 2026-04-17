#!/usr/bin/env node

const { loadSessionState, saveSessionState } = require('../src/state');
const { getNowIso, diffMs } = require('../src/time');
const { formatElapsed } = require('../src/duration');

const DEFAULT_DROP_SECONDS_AFTER = 900;
const MODEL_CHANGED_PLACEHOLDER = '---';

async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }

  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

function parseArgs(argv) {
  const args = {
    sessionId: null,
    modelId: null,
    dropSecondsAfterSeconds: DEFAULT_DROP_SECONDS_AFTER
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--session-id') {
      args.sessionId = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith('--session-id=')) {
      args.sessionId = arg.slice('--session-id='.length) || null;
    } else if (arg === '--model-id') {
      args.modelId = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith('--model-id=')) {
      args.modelId = arg.slice('--model-id='.length) || null;
    } else if (arg === '--drop-seconds-after') {
      args.dropSecondsAfterSeconds = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--drop-seconds-after=')) {
      args.dropSecondsAfterSeconds = Number(arg.slice('--drop-seconds-after='.length));
    }
  }

  if (!Number.isFinite(args.dropSecondsAfterSeconds) || args.dropSecondsAfterSeconds < 0) {
    args.dropSecondsAfterSeconds = DEFAULT_DROP_SECONDS_AFTER;
  }

  return args;
}

function parseStdinJson(stdinRaw) {
  if (!stdinRaw) return null;
  try {
    return JSON.parse(stdinRaw);
  } catch {
    return null;
  }
}

function resolveSessionId(stdinJson, argSessionId) {
  if (argSessionId) return argSessionId;
  if (stdinJson && typeof stdinJson.session_id === 'string' && stdinJson.session_id) {
    return stdinJson.session_id;
  }
  return null;
}

function resolveModelId(stdinJson, argModelId) {
  if (argModelId) return argModelId;
  if (stdinJson && stdinJson.model && typeof stdinJson.model.id === 'string' && stdinJson.model.id) {
    return stdinJson.model.id;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;

  if (!dataDir) {
    return;
  }

  const rawInput = await readStdin();
  const stdinJson = parseStdinJson(rawInput);
  const sessionId = resolveSessionId(stdinJson, args.sessionId);

  if (!sessionId) {
    return;
  }

  const session = await loadSessionState({ dataDir, sessionId });

  if (!session || !session.lastStopAt) {
    return;
  }

  const currentModelId = resolveModelId(stdinJson, args.modelId);
  const stopAt = session.lastStopAt;

  if (currentModelId) {
    if (session.modelAtLastStopAt !== stopAt) {
      await saveSessionState({
        dataDir,
        sessionId,
        state: {
          ...session,
          modelAtLastStop: currentModelId,
          modelAtLastStopAt: stopAt
        }
      });
    } else if (session.modelAtLastStop && session.modelAtLastStop !== currentModelId) {
      process.stdout.write(MODEL_CHANGED_PLACEHOLDER);
      return;
    }
  }

  const elapsedMs = diffMs(getNowIso(), stopAt);
  const formatted = formatElapsed(elapsedMs, {
    dropSecondsAfterSeconds: args.dropSecondsAfterSeconds
  });

  if (formatted) {
    process.stdout.write(formatted);
  }
}

main().catch(() => {
  process.exit(0);
});
