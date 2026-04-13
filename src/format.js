const IDLE_SYSTEM_MESSAGE_THRESHOLD_MS = 60 * 1000;

function appendDurationLine(lines, name, value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    lines.push(`${name}: ${(value / 1000).toFixed(1)}`);
  }
}

function formatTimingBlock({
  userMessageUtc,
  idleSinceLastStopMs,
  lastTurnExecMs
}) {
  const lines = ['[message_timing]', `user_message_utc: ${userMessageUtc}`];

  appendDurationLine(lines, 'idle_since_last_stop_seconds', idleSinceLastStopMs);
  appendDurationLine(lines, 'last_turn_exec_seconds', lastTurnExecMs);

  lines.push('[/message_timing]');
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
