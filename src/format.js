const { stripMs } = require('./time');

const IDLE_SYSTEM_MESSAGE_THRESHOLD_MS = 60 * 1000;

function appendDuration(parts, name, valueMs) {
  if (typeof valueMs === 'number' && Number.isFinite(valueMs)) {
    parts.push(`${name}=${(valueMs / 1000).toFixed(1)}s`);
  }
}

function formatTimingBlock({
  userMessageTime,
  idleSinceLastStopMs,
  lastTurnExecMs
}) {
  const lines = ['[timing]', `time=${stripMs(userMessageTime)}`];
  appendDuration(lines, 'idle_for', idleSinceLastStopMs);
  appendDuration(lines, 'last_turn', lastTurnExecMs);
  lines.push('[/timing]');
  return lines.join('\n');
}

function formatIdleSystemMessage(valueMs) {
  if (
    typeof valueMs !== 'number' ||
    !Number.isFinite(valueMs) ||
    valueMs <= IDLE_SYSTEM_MESSAGE_THRESHOLD_MS
  ) {
    return null;
  }

  const totalSeconds = Math.floor(valueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${seconds}s`);

  return `[after ${parts.join(' ')}]`;
}

module.exports = {
  formatIdleSystemMessage,
  formatTimingBlock
};
