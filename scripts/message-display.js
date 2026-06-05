#!/usr/bin/env node

/**
 * MessageDisplay hook — user-facing, display-only visible timestamp.
 *
 * Prepends a local-time `[HH:MM:SS]` marker to each assistant message on
 * screen. Display-only: MessageDisplay never changes the transcript or what
 * Claude sees, so the marker cannot confuse the model.
 *
 * MessageDisplay fires once per streamed batch of an assistant message with a
 * zero-based `index`; we stamp only the first batch (index === 0) so the
 * marker appears exactly once per message, then pass later batches through
 * unchanged.
 *
 * Toggle: `CLAUDE_TIMING_MESSAGE_DISPLAY` (default on). When off, we emit
 * nothing and Claude Code displays the original message unchanged.
 *
 * The MessageDisplay approach (hook event, `index`/`delta` contract,
 * `[HH:MM:SS]` marker) is adapted from
 * zoharbabin/claude-code-message-timestamps (MIT) — see THIRD-PARTY-LICENSES.md.
 *
 * Requires Claude Code 2.1.152+ (which added the MessageDisplay hook). On
 * older versions the hook never fires and the plugin's other surfaces are
 * unaffected.
 */

'use strict';

const { getNowIso, clockFromIso } = require('../src/time');
const { isEnabled, messageDisplayColorCode } = require('../src/config');

async function readStdin() {
  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

async function main() {
  if (!isEnabled('messageDisplay')) {
    return; // disabled → no output; original message shown unchanged
  }

  const rawInput = await readStdin();
  const hookInput = JSON.parse(rawInput || '{}');
  const delta = typeof hookInput.delta === 'string' ? hookInput.delta : '';
  const clock = hookInput.index === 0 ? clockFromIso(getNowIso()) : null;

  let displayContent;

  if (clock) {
    // Colour ONLY the marker; reset before the delta so the assistant's text
    // is never recoloured and no SGR code bleeds past the timestamp.
    const code = messageDisplayColorCode();
    const marker = code ? `[${code}m[${clock}][0m` : `[${clock}]`;
    displayContent = `${marker} ${delta}`;
  } else {
    displayContent = delta;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'MessageDisplay',
        displayContent
      }
    })
  );
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error.message}\n`);
  process.exit(0);
});
