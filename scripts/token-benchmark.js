#!/usr/bin/env node

const { encode } = require('gpt-tokenizer');
const { formatTimingBlock } = require('../src/format');

const ts = '2026-04-17T16:04:19+10:00';
const tsUtc = '2026-04-17T06:04:19.041Z';

const payloads = {
  'legacy baseline (UTC, verbose names)':
    [
      '[message_timing]',
      `user_message_utc: ${tsUtc}`,
      'idle_since_last_stop_seconds: 57.0',
      'last_turn_exec_seconds: 88.2',
      '[/message_timing]'
    ].join('\n'),

  'current: first prompt (no prior state)':
    formatTimingBlock({ userMessageTime: ts }),

  'current: mid-session (idle + last_turn)':
    formatTimingBlock({
      userMessageTime: ts,
      idleSinceLastStopMs: 57_000,
      lastTurnExecMs: 88_200
    }),

  'current: long idle (hours)':
    formatTimingBlock({
      userMessageTime: ts,
      idleSinceLastStopMs: 14_732_500,
      lastTurnExecMs: 88_200
    }),

  'current: quick reply (sub-second idle)':
    formatTimingBlock({
      userMessageTime: ts,
      idleSinceLastStopMs: 100,
      lastTurnExecMs: 3_700
    })
};

const rows = Object.entries(payloads).map(([name, text]) => ({
  name,
  tokens: encode(text).length,
  chars: text.length,
  text
}));

const nameWidth = Math.max(...rows.map((r) => r.name.length));

for (const { name, tokens, chars, text } of rows) {
  console.log(`${name.padEnd(nameWidth)}  ${String(tokens).padStart(3)}t  ${String(chars).padStart(4)}c`);
  for (const line of text.split('\n')) {
    console.log(`    ${line}`);
  }
  console.log('');
}
