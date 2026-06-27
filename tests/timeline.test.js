const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'timeline.sh');
const CLAUDE_PROJECTS = path.join(os.homedir(), '.claude', 'projects');

// The project folder name is deliberately unrelated to the recorded cwd —
// timeline.sh must locate the session by the in-file cwd, not the folder name.
function writeTranscript(projectDirName, fileName, cwd, lines) {
  const dir = path.join(CLAUDE_PROJECTS, projectDirName);

  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, fileName);
  const body =
    lines.map((l) => JSON.stringify({ cwd, ...l })).join('\n') + '\n';

  fs.writeFileSync(filePath, body);

  return { dir, filePath };
}

function makeWorkdir(prefix) {
  // Resolve tmpdir so $PWD inside bash matches the recorded cwd (no symlinks).
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
}

function runTimeline(fromCwd, count) {
  const args = [SCRIPT_PATH];

  if (count !== undefined) {
    args.push(String(count));
  }

  return execFileSync('bash', args, {
    cwd: fromCwd,
    encoding: 'utf8',
    timeout: 5000
  });
}

test('timeline.sh prints the timeline for the current working directory', () => {
  const workdir = makeWorkdir('cc-tl-');
  const { dir } = writeTranscript('cc-timeline-test', 'sess.jsonl', workdir, [
    {
      type: 'user',
      timestamp: '2026-04-23T18:00:00Z',
      message: { content: [{ type: 'text', text: 'timeline hello' }] }
    },
    {
      type: 'assistant',
      timestamp: '2026-04-23T18:00:05Z',
      message: { content: [{ type: 'text', text: 'timeline hi back' }] }
    }
  ]);

  const output = runTimeline(workdir);

  assert.match(output, /Message Timeline/);
  assert.match(output, /timeline hello/);
  assert.match(output, /timeline hi back/);

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(workdir, { recursive: true, force: true });
});

test('timeline.sh forwards the count argument', () => {
  const workdir = makeWorkdir('cc-tl-');
  const { dir } = writeTranscript(
    'cc-timeline-test-count',
    'sess.jsonl',
    workdir,
    [
      {
        type: 'user',
        timestamp: '2026-04-23T18:00:00Z',
        message: { content: [{ type: 'text', text: 'tl one' }] }
      },
      {
        type: 'user',
        timestamp: '2026-04-23T18:01:00Z',
        message: { content: [{ type: 'text', text: 'tl two' }] }
      },
      {
        type: 'user',
        timestamp: '2026-04-23T18:02:00Z',
        message: { content: [{ type: 'text', text: 'tl three' }] }
      }
    ]
  );

  const output = runTimeline(workdir, 2);

  assert.match(output, /Showing 2 of 3 messages/);
  assert.ok(!output.includes('tl one'), 'should drop the oldest beyond the count');

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(workdir, { recursive: true, force: true });
});

test('timeline.sh reports cleanly when no transcript matches the directory', () => {
  const workdir = makeWorkdir('cc-tl-nomatch-');

  assert.throws(() => runTimeline(workdir), /No transcript found/);

  fs.rmSync(workdir, { recursive: true, force: true });
});
