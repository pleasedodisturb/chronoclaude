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
  isEnabled
};
