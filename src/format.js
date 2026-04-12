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

module.exports = {
  formatTimingBlock
};
