const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_PATH = path.join(__dirname, '..', 'servers', 'time-server.js');
// Requiring the module returns pure helpers without booting the stdio server
// (guarded by require.main === module).
const { resolveDataDir } = require('../servers/time-server');

test('resolveDataDir prefers CLAUDE_PLUGIN_DATA when set', () => {
  assert.equal(resolveDataDir({ CLAUDE_PLUGIN_DATA: '/tmp/custom-data' }), '/tmp/custom-data');
});

test('resolveDataDir falls back to the documented plugin data path', () => {
  const dir = resolveDataDir({});
  assert.match(dir, /[/\\]\.claude[/\\]plugins[/\\]data[/\\]chronoclaude-chronoclaude$/);
});

function startServer(options = {}) {
  // Point the server at an isolated, empty data dir by default so get_timeline's
  // disk-merge fallback cannot read the real machine's plugin timelines. Tests
  // that exercise the merge pass an explicit dataDir seeded with fixtures.
  const dataDir =
    options.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-srv-'));

  const proc = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAUDE_TIMING_NOW_ISO: '2026-04-20T10:30:00.000+02:00',
      CLAUDE_PLUGIN_DATA: dataDir
    }
  });

  let buffer = '';
  const pending = new Map();
  let nextId = 0;

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');

    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const msg = JSON.parse(line);

      if (pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });

  function send(method, params = {}) {
    const id = nextId++;

    return new Promise((resolve) => {
      pending.set(id, resolve);
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async function init() {
    const res = await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1.0' }
    });

    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    return res;
  }

  function callTool(name, args = {}) {
    return send('tools/call', { name, arguments: args });
  }

  function kill() {
    proc.kill();
  }

  return { send, init, callTool, kill };
}

test('initialize returns server info and tool capability', async () => {
  const server = startServer();
  const res = await server.init();

  assert.equal(res.result.serverInfo.name, 'chronoclaude-time-server');
  assert.ok(res.result.capabilities.tools);
  server.kill();
});

test('tools/list returns all four tools', async () => {
  const server = startServer();
  await server.init();
  const res = await server.send('tools/list', {});
  const names = res.result.tools.map((t) => t.name).sort();

  assert.deepEqual(names, ['get_time', 'get_timeline', 'mark_event', 'time_diff']);
  server.kill();
});

test('get_time returns structured time data', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('get_time');
  const data = JSON.parse(res.result.content[0].text);

  assert.ok(data.iso);
  assert.ok(data.utc);
  assert.equal(typeof data.unix_ms, 'number');
  assert.equal(typeof data.unix_s, 'number');
  assert.equal(typeof data.timezone, 'string');
  assert.equal(typeof data.offset_minutes, 'number');
  server.kill();
});

test('time_diff computes duration between two timestamps', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('time_diff', {
    start: '2026-04-20T10:00:00Z',
    end: '2026-04-20T10:05:30Z'
  });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.diff_ms, 330000);
  assert.equal(data.diff_seconds, 330);
  assert.equal(data.human, '5m 30s');
  assert.equal(data.direction, 'forward');
  server.kill();
});

test('time_diff handles backward direction', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('time_diff', {
    start: '2026-04-20T10:05:30Z',
    end: '2026-04-20T10:00:00Z'
  });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.direction, 'backward');
  assert.equal(data.diff_ms, -330000);
  server.kill();
});

test('time_diff returns error for invalid timestamps', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('time_diff', {
    start: 'not-a-date',
    end: '2026-04-20T10:00:00Z'
  });
  const data = JSON.parse(res.result.content[0].text);

  assert.ok(data.error);
  server.kill();
});

test('mark_event records an event and reports null since_prev on first call', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('mark_event', { name: 'test_start' });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.name, 'test_start');
  assert.equal(data.index, 0);
  assert.equal(data.since_prev_ms, null);
  assert.equal(data.total_events, 1);
  server.kill();
});

test('mark_event computes since_prev on second call', async () => {
  const server = startServer();
  await server.init();
  await server.callTool('mark_event', { name: 'first' });

  // Small delay to ensure measurable difference
  await new Promise((r) => setTimeout(r, 50));

  const res = await server.callTool('mark_event', { name: 'second' });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.name, 'second');
  assert.equal(data.index, 1);
  assert.equal(typeof data.since_prev_ms, 'number');
  assert.ok(data.since_prev_ms >= 40, `Expected >= 40ms, got ${data.since_prev_ms}`);
  assert.equal(data.total_events, 2);
  server.kill();
});

test('get_timeline returns empty message when no events', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('get_timeline');
  const data = JSON.parse(res.result.content[0].text);

  assert.deepEqual(data.events, []);
  assert.ok(data.message);
  server.kill();
});

test('get_timeline returns events with durations after marking', async () => {
  const server = startServer();
  await server.init();

  await server.callTool('mark_event', { name: 'start' });
  await new Promise((r) => setTimeout(r, 50));
  await server.callTool('mark_event', { name: 'end' });

  const res = await server.callTool('get_timeline');
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.event_count, 2);
  assert.equal(data.events[0].name, 'start');
  assert.equal(data.events[1].name, 'end');
  assert.equal(data.events[0].since_prev_ms, null);
  assert.ok(data.events[1].since_prev_ms >= 40);
  assert.ok(data.total_duration_ms >= 40);
  server.kill();
});

test('unknown tool returns error response', async () => {
  const server = startServer();
  await server.init();
  const res = await server.callTool('nonexistent_tool');

  assert.ok(res.result.isError);
  server.kill();
});

function seedTimeline(lines) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-srv-'));
  const timelinesDir = path.join(dataDir, 'timelines');
  fs.mkdirSync(timelinesDir, { recursive: true });
  fs.writeFileSync(
    path.join(timelinesDir, 'sess.jsonl'),
    lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  );
  return dataDir;
}

test('get_timeline merges in-memory marks with the PostToolUse disk timeline (by session_id)', async () => {
  const dataDir = seedTimeline([
    { timestamp: '2026-04-20T10:00:00.000+02:00', tool: 'Read', event: 'tool_complete' },
    { timestamp: '2026-04-20T10:00:10.000+02:00', tool: 'Edit', event: 'tool_complete' }
  ]);

  const server = startServer({ dataDir });
  await server.init();
  // mark_event uses real wall-clock (now), which is far later than the fixtures,
  // so it sorts last regardless of the machine's date.
  await server.callTool('mark_event', { name: 'checkpoint' });
  const res = await server.callTool('get_timeline', { session_id: 'sess' });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.event_count, 3);
  assert.deepEqual(data.events.map((e) => e.name), ['Read', 'Edit', 'checkpoint']);
  assert.deepEqual(data.events.map((e) => e.kind), ['tool', 'tool', 'mark']);
  assert.equal(data.events[0].since_prev_ms, null);
  assert.equal(data.events[1].since_prev_ms, 10000);
  server.kill();
});

test('get_timeline interleaves a mark chronologically between disk events', async () => {
  // A far-past and far-future tool event straddle the mark's real wall-clock
  // time, so the mark must sort *between* them — exercising true interleaving.
  const dataDir = seedTimeline([
    { timestamp: '2020-01-01T00:00:00.000+00:00', tool: 'Past', event: 'tool_complete' },
    { timestamp: '2099-01-01T00:00:00.000+00:00', tool: 'Future', event: 'tool_complete' }
  ]);

  const server = startServer({ dataDir });
  await server.init();
  await server.callTool('mark_event', { name: 'mid' });
  const res = await server.callTool('get_timeline', { session_id: 'sess' });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.event_count, 3);
  assert.deepEqual(data.events.map((e) => e.name), ['Past', 'mid', 'Future']);
  assert.deepEqual(data.events.map((e) => e.kind), ['tool', 'mark', 'tool']);
  // gaps are positive and ordered (no negative since_prev from a bad sort)
  assert.ok(data.events[1].since_prev_ms > 0);
  assert.ok(data.events[2].since_prev_ms > 0);
  server.kill();
});

test('get_timeline reads the most-recent disk timeline when no session_id is given', async () => {
  const dataDir = seedTimeline([
    { timestamp: '2026-04-20T09:00:00.000+02:00', tool: 'Bash', event: 'tool_complete' }
  ]);

  const server = startServer({ dataDir });
  await server.init();
  const res = await server.callTool('get_timeline');
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.event_count, 1);
  assert.equal(data.events[0].name, 'Bash');
  assert.equal(data.events[0].kind, 'tool');
  server.kill();
});

test('get_timeline tolerates a corrupt timeline line without throwing', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoclaude-srv-'));
  const timelinesDir = path.join(dataDir, 'timelines');
  fs.mkdirSync(timelinesDir, { recursive: true });
  fs.writeFileSync(
    path.join(timelinesDir, 'sess.jsonl'),
    '{ not valid json\n' +
      JSON.stringify({ timestamp: '2026-04-20T10:00:00.000+02:00', tool: 'Read', event: 'tool_complete' }) +
      '\n'
  );

  const server = startServer({ dataDir });
  await server.init();
  const res = await server.callTool('get_timeline', { session_id: 'sess' });
  const data = JSON.parse(res.result.content[0].text);

  assert.equal(data.event_count, 1);
  assert.equal(data.events[0].name, 'Read');
  server.kill();
});
