'use strict';

/**
 * Per-surface on/off toggles.
 *
 * Each user-facing surface can be disabled independently via an environment
 * variable. Surfaces are ON by default — a surface is only disabled when its
 * variable is explicitly set to a falsy value (`0`, `false`, `off`, `no`,
 * case-insensitive). Unknown/unset variables leave the surface on, so a typo
 * never silently suppresses output.
 *
 * Env-var driven (not a config file) to match the existing `CLAUDE_TIMING_*`
 * idiom (see `src/time.js` `CLAUDE_TIMING_NOW_ISO`) and to stay trivially
 * testable. Set toggles in the `env` block of `~/.claude/settings.json`.
 */

const SURFACES = {
  passive: 'CLAUDE_TIMING_PASSIVE',
  idleNote: 'CLAUDE_TIMING_IDLE_NOTE',
  messageDisplay: 'CLAUDE_TIMING_MESSAGE_DISPLAY',
  timeline: 'CLAUDE_TIMING_TIMELINE'
};

const OFF_VALUES = new Set(['0', 'false', 'off', 'no']);

// Named colours → SGR code for the visible MessageDisplay marker.
const COLOR_CODES = {
  grey: '90',
  gray: '90',
  dim: '2',
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37'
};
const DEFAULT_MESSAGE_DISPLAY_COLOR = '90'; // bright black / grey

// Resolves the SGR code used to colour the [HH:MM:SS] marker.
// Returns the code string (e.g. '90', '1;90') or null for "no colour".
// Unset → default grey. 'none'/'off'/'plain' → null. Unknown → default (never break).
function messageDisplayColorCode(env = process.env) {
  const raw = (env.CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR || '').trim().toLowerCase();

  if (!raw) {
    return DEFAULT_MESSAGE_DISPLAY_COLOR;
  }

  if (raw === 'none' || raw === 'off' || raw === 'plain') {
    return null;
  }

  if (COLOR_CODES[raw]) {
    return COLOR_CODES[raw];
  }

  if (/^\d{1,3}(;\d{1,3})*$/.test(raw)) {
    return raw; // raw SGR sequence, e.g. '90' or '1;90'
  }

  return DEFAULT_MESSAGE_DISPLAY_COLOR;
}

// SGR colour in the MessageDisplay `displayContent` only renders on surfaces
// that interpret ANSI. Rich-text chat panels do not: the VS Code extension
// panel renders the assistant message as formatted text and shows the raw
// escapes as literal `[90m[12:34:56][0m` junk (confirmed, anthropics/claude-code
// #44763). The host advertises the surface via `CLAUDE_CODE_ENTRYPOINT` — values
// taken from Claude Code's own entrypoint switch: `cli` (terminal TUI),
// `claude-vscode` (VS Code chat panel), `remote*`, `mcp`, `sdk-*`, etc.
//
// Rule: emit colour only for `cli` or unset; plain marker otherwise.
//   - VS Code chat panel → `claude-vscode` → plain (fixes the leak).
//   - Terminal TUI, and VS Code's *integrated terminal* → `cli` → colour.
//   - JetBrains: its integration runs the CLI inside the IDE's terminal tool
//     window (a real ANSI terminal — cf. `isJetBrainsIdeTerminal` in the CC
//     binary), so it reports `cli` and colour renders fine. Inferred, not yet
//     tested end-to-end, but safe either way: the only colour branch requires
//     an ANSI-capable `cli` surface, so a distinct/non-cli entrypoint would just
//     fall through to plain.
//   - unset → assume terminal (covers the test harness; preserves the grey
//     default). Any other value → plain, no escape codes.
const TERMINAL_ENTRYPOINTS = new Set(['cli']);

function terminalSupportsAnsi(env = process.env) {
  const entrypoint = (env.CLAUDE_CODE_ENTRYPOINT || '').trim().toLowerCase();

  if (!entrypoint) {
    return true; // unset → assume terminal (keeps the default-grey behavior)
  }

  return TERMINAL_ENTRYPOINTS.has(entrypoint);
}

function isEnabled(key, env = process.env) {
  const varName = SURFACES[key];

  if (!varName) {
    return true; // unknown surface → on (never silently suppress)
  }

  const raw = env[varName];

  if (raw === undefined || raw === null || raw === '') {
    return true;
  }

  return !OFF_VALUES.has(String(raw).trim().toLowerCase());
}

module.exports = {
  SURFACES,
  isEnabled,
  terminalSupportsAnsi,
  messageDisplayColorCode
};
