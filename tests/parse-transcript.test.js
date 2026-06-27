const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'parse-transcript.py');

function createFakeTranscript(lines) {
  // Create inside ~/.claude/projects/ so validation passes
  const claudeProjects = path.join(os.homedir(), '.claude', 'projects');
  const testDir = path.join(claudeProjects, 'test-parse-transcript');

  fs.mkdirSync(testDir, { recursive: true });

  const filePath = path.join(testDir, 'test-session.jsonl');

  fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');

  return filePath;
}

function runParser(transcriptPath, count) {
  const args = [SCRIPT_PATH, transcriptPath];

  if (count !== undefined) {
    args.push(String(count));
  }

  return execFileSync('python3', args, {
    encoding: 'utf8',
    timeout: 5000
  });
}

test('parse-transcript shows user and assistant messages with timestamps', () => {
  const transcriptPath = createFakeTranscript([
    {
      type: 'user',
      timestamp: '2026-04-23T18:00:00Z',
      message: { content: [{ type: 'text', text: 'Hello Claude' }] }
    },
    {
      type: 'assistant',
      timestamp: '2026-04-23T18:00:05Z',
      message: { content: [{ type: 'text', text: 'Hi there!' }] }
    }
  ]);

  const output = runParser(transcriptPath);

  assert.match(output, /Message Timeline/);
  assert.match(output, /You.*Hello Claude/);
  assert.match(output, /Claude.*Hi there!/);
  assert.match(output, /Showing 2 of 2 messages/);

  fs.unlinkSync(transcriptPath);
});

test('parse-transcript respects count argument', () => {
  const transcriptPath = createFakeTranscript([
    { type: 'user', timestamp: '2026-04-23T18:00:00Z', message: { content: [{ type: 'text', text: 'msg 1' }] } },
    { type: 'user', timestamp: '2026-04-23T18:01:00Z', message: { content: [{ type: 'text', text: 'msg 2' }] } },
    { type: 'user', timestamp: '2026-04-23T18:02:00Z', message: { content: [{ type: 'text', text: 'msg 3' }] } }
  ]);

  const output = runParser(transcriptPath, 2);

  assert.match(output, /Showing 2 of 3 messages/);
  assert.match(output, /msg 2/);
  assert.match(output, /msg 3/);
  assert.ok(!output.includes('msg 1'), 'should not include oldest message');

  fs.unlinkSync(transcriptPath);
});

test('parse-transcript shows tool use entries', () => {
  const transcriptPath = createFakeTranscript([
    {
      type: 'assistant',
      timestamp: '2026-04-23T18:00:00Z',
      message: { content: [{ type: 'tool_use', name: 'Read' }] }
    }
  ]);

  const output = runParser(transcriptPath);

  assert.match(output, /\[tool: Read\]/);

  fs.unlinkSync(transcriptPath);
});

test('parse-transcript skips non-message entries', () => {
  const transcriptPath = createFakeTranscript([
    { type: 'system', timestamp: '2026-04-23T18:00:00Z', message: { content: 'system msg' } },
    { type: 'user', timestamp: '2026-04-23T18:00:01Z', message: { content: [{ type: 'text', text: 'real msg' }] } }
  ]);

  const output = runParser(transcriptPath);

  assert.match(output, /Showing 1 of 1 messages/);

  fs.unlinkSync(transcriptPath);
});

test('parse-transcript rejects paths outside ~/.claude/projects/', () => {
  const tmpFile = path.join(os.tmpdir(), 'fake.jsonl');

  fs.writeFileSync(tmpFile, '{}');

  assert.throws(() => runParser(tmpFile), /Error/);

  fs.unlinkSync(tmpFile);
});

function createTranscriptWithCwd(dirName, fileName, cwd, lines) {
  // The project folder name is deliberately unrelated to the recorded cwd —
  // discovery must match on the in-file cwd, not the folder name.
  const claudeProjects = path.join(os.homedir(), '.claude', 'projects');
  const testDir = path.join(claudeProjects, dirName);

  fs.mkdirSync(testDir, { recursive: true });

  const filePath = path.join(testDir, fileName);
  const body =
    lines.map((l) => JSON.stringify({ cwd, ...l })).join('\n') + '\n';

  fs.writeFileSync(filePath, body);

  return { filePath, testDir };
}

function runParserCwd(cwd, count) {
  const args = [SCRIPT_PATH, '--cwd', cwd];

  if (count !== undefined) {
    args.push(String(count));
  }

  return execFileSync('python3', args, { encoding: 'utf8', timeout: 5000 });
}

test('parse-transcript --cwd matches the recorded working directory (handles dots/spaces)', () => {
  // A cwd a naive `pwd | sed s,/,-,g` could never reconstruct correctly.
  const cwd = '/home/tester/my.project dir.unique-aaa';
  const { testDir } = createTranscriptWithCwd(
    'cc-cwd-test-dotted',
    'sess.jsonl',
    cwd,
    [
      {
        type: 'user',
        timestamp: '2026-04-23T18:00:00Z',
        message: { content: [{ type: 'text', text: 'dotted hello' }] }
      }
    ]
  );

  const output = runParserCwd(cwd);

  assert.match(output, /dotted hello/);

  fs.rmSync(testDir, { recursive: true, force: true });
});

test('parse-transcript --cwd reports no transcript when nothing matches', () => {
  assert.throws(
    () => runParserCwd('/nonexistent/path/unique-zzz-no-match'),
    /No transcript found/
  );
});

test('parse-transcript --cwd picks the most recent matching transcript', () => {
  const cwd = '/home/tester/multi.unique-bbb';

  const older = createTranscriptWithCwd('cc-cwd-test-multi', 'old.jsonl', cwd, [
    {
      type: 'user',
      timestamp: '2026-04-23T18:00:00Z',
      message: { content: [{ type: 'text', text: 'old transcript msg' }] }
    }
  ]);
  const newer = createTranscriptWithCwd('cc-cwd-test-multi', 'new.jsonl', cwd, [
    {
      type: 'user',
      timestamp: '2026-04-23T19:00:00Z',
      message: { content: [{ type: 'text', text: 'new transcript msg' }] }
    }
  ]);

  const now = Date.now() / 1000;
  fs.utimesSync(older.filePath, now - 120, now - 120);
  fs.utimesSync(newer.filePath, now + 120, now + 120);

  const output = runParserCwd(cwd);

  assert.match(output, /new transcript msg/);
  assert.ok(
    !output.includes('old transcript msg'),
    'should select the newest matching transcript only'
  );

  fs.rmSync(newer.testDir, { recursive: true, force: true });
});
