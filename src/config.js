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
  messageDisplayColorCode
};
