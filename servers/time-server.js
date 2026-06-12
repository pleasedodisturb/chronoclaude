#!/usr/bin/env node

/**
 * MCP time-awareness server — exposes active time query tools.
 *
 * Complements the plugin's passive hook-based timing injection with tools
 * Claude can call on demand: get current time, compute durations, mark
 * named events, and retrieve a session timeline.
 *
 * Zero runtime dependencies — hand-rolled JSON-RPC 2.0 over stdio.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { getNowIso, diffMs, toLocalIso } = require('../src/time');
const { formatElapsed } = require('../src/duration');
const { sanitizeSessionId } = require('../src/state');

const SERVER_INFO = { name: 'idle-timing-time-server', version: '0.5.1' };
const DROP_SECONDS_AFTER = 900;
// Defensive cap on the disk timeline read: a normal session logs ~60 bytes per
// tool call, so 10 MB (~170k calls) is far beyond any real session. Guards
// against reading a pathologically large or non-regular file into memory.
const MAX_TIMELINE_BYTES = 10 * 1024 * 1024;

// In-memory event log (session-scoped, resets on server restart)
const eventLog = [];

// --- Disk timeline (PostToolUse log) integration ---
//
// PostToolUse writes auto-logged tool calls to
// `${CLAUDE_PLUGIN_DATA}/timelines/<session>.jsonl`. get_timeline merges that
// durable history with the in-memory marks below so the auto-logged tool
// timeline is actually queryable (it used to be a write-only dead-end).

function resolveDataDir(env = process.env) {
  if (env.CLAUDE_PLUGIN_DATA) {
    return env.CLAUDE_PLUGIN_DATA;
  }

  // MCP servers may launch without CLAUDE_PLUGIN_DATA set; fall back to the
  // documented install path (see repo CLAUDE.md / statusline note).
  return path.join(os.homedir(), '.claude', 'plugins', 'data', 'chronoclaude-chronoclaude');
}

// Returns parsed `{timestamp, tool, event}` lines from the on-disk tool
// timeline. Never throws — a missing dir/file or read error yields []. When no
// session_id is given, the most-recently-modified timeline file is used as a
// best-effort guess at the current session.
function readDiskTimeline(sessionId, env = process.env) {
  try {
    const dir = path.join(resolveDataDir(env), 'timelines');
    let file;

    if (sessionId) {
      file = path.join(dir, `${sanitizeSessionId(sessionId)}.jsonl`);
    } else {
      const candidates = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl'));

      if (candidates.length === 0) {
        return [];
      }

      file = candidates
        .map((name) => ({
          name,
          mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].name;
      file = path.join(dir, file);
    }

    const stat = fs.statSync(file);

    if (!stat.isFile() || stat.size > MAX_TIMELINE_BYTES) {
      return []; // skip non-regular files (fifo/symlink-to-device) and oversized logs
    }

    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// --- Tool definitions ---

const TOOLS = [
  {
    name: 'get_time',
    description: 'Get the current time as structured data — ISO timestamp, unix epoch, and timezone.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'time_diff',
    description: 'Compute the duration between two ISO timestamps. Returns human-readable and machine-readable durations.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'ISO 8601 timestamp (start)' },
        end: { type: 'string', description: 'ISO 8601 timestamp (end)' }
      },
      required: ['start', 'end']
    }
  },
  {
    name: 'mark_event',
    description: 'Record a named event with the current timestamp. Use to build a session timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Event name, e.g. 'build_started' or 'tests_passed'" }
      },
      required: ['name']
    }
  },
  {
    name: 'get_timeline',
    description: 'Get the session timeline — marked events plus auto-logged tool calls — in chronological order with durations between them.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Optional session id; defaults to the most recent session timeline on disk.' }
      },
      required: []
    }
  }
];

// --- Tool handlers ---

function handleGetTime() {
  const now = new Date();

  return JSON.stringify({
    iso: toLocalIso(now),
    utc: now.toISOString(),
    unix_ms: now.getTime(),
    unix_s: Math.floor(now.getTime() / 1000),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset_minutes: now.getTimezoneOffset()
  });
}

function handleTimeDiff({ start, end }) {
  const diffResult = diffMs(end, start);

  if (diffResult === null) {
    return JSON.stringify({ error: 'Invalid timestamp(s)' });
  }

  return JSON.stringify({
    start,
    end,
    diff_ms: diffResult,
    diff_seconds: diffResult / 1000,
    human: formatElapsed(Math.abs(diffResult), { dropSecondsAfterSeconds: DROP_SECONDS_AFTER }) || '0s',
    direction: diffResult >= 0 ? 'forward' : 'backward'
  });
}

function handleMarkEvent({ name }) {
  const now = new Date();
  const event = {
    name,
    iso: toLocalIso(now),
    unix_ms: now.getTime(),
    index: eventLog.length
  };

  eventLog.push(event);

  const prev = eventLog.length > 1 ? eventLog[eventLog.length - 2] : null;
  const sincePrevMs = prev ? now.getTime() - prev.unix_ms : null;

  return JSON.stringify({
    ...event,
    since_prev_ms: sincePrevMs,
    since_prev_human: sincePrevMs !== null
      ? formatElapsed(sincePrevMs, { dropSecondsAfterSeconds: DROP_SECONDS_AFTER })
      : null,
    total_events: eventLog.length
  });
}

function handleGetTimeline(args = {}) {
  // In-memory marks (from mark_event).
  const marks = eventLog.map((event) => ({
    kind: 'mark',
    name: event.name,
    iso: event.iso,
    unix_ms: event.unix_ms
  }));

  // Auto-logged tool calls from the PostToolUse disk timeline.
  const toolEvents = readDiskTimeline(args.session_id)
    .map((entry) => ({
      kind: 'tool',
      name: entry.tool || 'unknown',
      iso: entry.timestamp,
      unix_ms: Date.parse(entry.timestamp)
    }))
    .filter((entry) => Number.isFinite(entry.unix_ms));

  const merged = [...marks, ...toolEvents].sort((a, b) => a.unix_ms - b.unix_ms);

  if (merged.length === 0) {
    return JSON.stringify({
      events: [],
      message: 'No events recorded yet. Use mark_event, or let the PostToolUse hook auto-log tool calls.'
    });
  }

  const timeline = merged.map((event, i) => {
    const prev = i > 0 ? merged[i - 1] : null;
    const sincePrevMs = prev ? event.unix_ms - prev.unix_ms : null;

    return {
      kind: event.kind,
      name: event.name,
      iso: event.iso,
      since_prev_ms: sincePrevMs,
      since_prev_human: sincePrevMs !== null
        ? formatElapsed(sincePrevMs, { dropSecondsAfterSeconds: DROP_SECONDS_AFTER })
        : null
    };
  });

  const totalMs = merged[merged.length - 1].unix_ms - merged[0].unix_ms;

  return JSON.stringify({
    events: timeline,
    total_duration_ms: totalMs,
    total_duration_human: formatElapsed(totalMs, { dropSecondsAfterSeconds: DROP_SECONDS_AFTER }) || '0s',
    event_count: merged.length
  });
}

const HANDLERS = {
  get_time: handleGetTime,
  time_diff: handleTimeDiff,
  mark_event: handleMarkEvent,
  get_timeline: handleGetTimeline
};

// --- JSON-RPC 2.0 server over stdio ---

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return makeResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO
    });
  }

  if (method === 'notifications/initialized') {
    return null; // notification, no response
  }

  if (method === 'tools/list') {
    return makeResponse(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const toolName = params && params.name;
    const handler = HANDLERS[toolName];

    if (!handler) {
      return makeResponse(id, {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true
      });
    }

    // Never let a handler throw unwind past here — that would leave the client
    // waiting forever for a response to this request id. Always return an
    // error envelope instead.
    try {
      const text = handler(params.arguments || {});

      return makeResponse(id, {
        content: [{ type: 'text', text }]
      });
    } catch (err) {
      return makeResponse(id, {
        content: [{ type: 'text', text: JSON.stringify({ error: String((err && err.message) || err) }) }],
        isError: true
      });
    }
  }

  if (method === 'ping') {
    return makeResponse(id, {});
  }

  // Unknown method
  if (id !== undefined) {
    return makeError(id, -32601, `Method not found: ${method}`);
  }

  return null;
}

// --- stdio transport ---

function startStdioServer() {
  let buffer = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');

    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const msg = JSON.parse(line);
        const response = handleMessage(msg);

        if (response !== null) {
          process.stdout.write(response + '\n');
        }
      } catch (err) {
        process.stderr.write(`Parse error: ${err.message}\n`);
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });

  process.stderr.write(`${SERVER_INFO.name} v${SERVER_INFO.version} running on stdio\n`);
}

// Only boot the stdio server when run directly; `require()` (tests) gets the
// pure helpers without attaching stdin listeners or printing the banner.
if (require.main === module) {
  startStdioServer();
}

module.exports = {
  resolveDataDir,
  readDiskTimeline,
  handleGetTimeline,
  handleMessage
};
