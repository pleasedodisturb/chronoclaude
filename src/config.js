'use strict';

/**
 * Per-surface on/off toggles.
 *
 * Each user-facing surface can be disabled independently via an environment
 * variable. Most surfaces are ON by default — disabled only when their variable
 * is explicitly set to a falsy value (`0`, `false`, `off`, `no`,
 * case-insensitive). Unknown/unset variables leave the surface on, so a typo
 * never silently suppresses output.
 *
 * A small set of surfaces are *opt-in* (OFF by default, see `OPT_IN_SURFACES`):
 * they only turn on for an explicit truthy value (`1`, `true`, `on`, `yes`).
 * These are workarounds that would otherwise duplicate another surface — e.g.
 * `stopTimestamp` emits a per-turn `[HH:MM:SS]` note for IDE-extension panels
 * (VSCode/JetBrains) where the inline `MessageDisplay` marker never fires;
 * leaving it on by default would double-stamp every turn in the terminal TUI,
 * which already gets the inline marker.
 *
 * Env-var driven (not a config file) to match the existing `CLAUDE_TIMING_*`
 * idiom (see `src/time.js` `CLAUDE_TIMING_NOW_ISO`) and to stay trivially
 * testable. Set toggles in the `env` block of `~/.claude/settings.json`.
 */

const SURFACES = {
  passive: 'CLAUDE_TIMING_PASSIVE',
  idleNote: 'CLAUDE_TIMING_IDLE_NOTE',
  messageDisplay: 'CLAUDE_TIMING_MESSAGE_DISPLAY',
  timeline: 'CLAUDE_TIMING_TIMELINE',
  stopTimestamp: 'CLAUDE_TIMING_STOP_TIMESTAMP'
};

// Surfaces that are OFF by default and require an explicit truthy value to
// enable (the inverse of the default-on surfaces above).
const OPT_IN_SURFACES = new Set(['stopTimestamp']);

const OFF_VALUES = new Set(['0', 'false', 'off', 'no']);
const ON_VALUES = new Set(['1', 'true', 'on', 'yes']);

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

// SGR colour in the MessageDisplay `displayContent` only renders in the real
// terminal TUI. GUI/remote clients (VS Code / JetBrains extension panels, web,
// mobile, etc.) display the raw escape codes as literal text — e.g. a grey
// marker leaks as `[90m[12:34:56][0m` on screen. The host advertises the client
// via `CLAUDE_CODE_ENTRYPOINT` (`cli` for the terminal; `claude-vscode`,
// `remote*`, … for everything else — see Claude Code's entrypoint switch). We
// only emit colour when we're confident the surface renders ANSI: entrypoint
// `cli`, or unset (covers the test harness and preserves the historical grey
// default). Any other value → plain marker, no escape codes.
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
  const optIn = OPT_IN_SURFACES.has(key);

  if (raw === undefined || raw === null || raw === '') {
    return !optIn; // default-on surfaces → on; opt-in surfaces → off
  }

  const value = String(raw).trim().toLowerCase();

  // Opt-in surfaces turn on ONLY for an explicit truthy value; default-on
  // surfaces turn off ONLY for an explicit falsy value.
  return optIn ? ON_VALUES.has(value) : !OFF_VALUES.has(value);
}

module.exports = {
  SURFACES,
  OPT_IN_SURFACES,
  isEnabled,
  terminalSupportsAnsi,
  messageDisplayColorCode
};
