#!/usr/bin/env node

const { loadSessionState } = require('../src/state');
const { getNowIso, diffMs } = require('../src/time');
const { formatElapsed } = require('../src/duration');

const DEFAULT_DROP_SECONDS_AFTER = 900;

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
  const args = { sessionId: null, dropSecondsAfterSeconds: DEFAULT_DROP_SECONDS_AFTER };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--session-id') {
      args.sessionId = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith('--session-id=')) {
      args.sessionId = arg.slice('--session-id='.length) || null;
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

function resolveSessionId(stdinRaw, argSessionId) {
  if (argSessionId) {
    return argSessionId;
  }

  if (!stdinRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(stdinRaw);
    if (parsed && typeof parsed.session_id === 'string' && parsed.session_id) {
      return parsed.session_id;
    }
  } catch {
    return null;
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
  const sessionId = resolveSessionId(rawInput, args.sessionId);

  if (!sessionId) {
    return;
  }

  const session = await loadSessionState({ dataDir, sessionId });

  if (!session || !session.lastStopAt) {
    return;
  }

  const elapsedMs = diffMs(getNowIso(), session.lastStopAt);
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
