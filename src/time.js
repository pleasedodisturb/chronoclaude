function toIsoUtc(value) {
  return new Date(value).toISOString();
}

function toLocalIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMin);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${sign}${offH}:${offM}`;
}

function getNowIso(env = process.env, nowFactory = () => new Date()) {
  return env.CLAUDE_TIMING_NOW_ISO || toLocalIso(nowFactory());
}

function stripMs(iso) {
  return iso.replace(/\.\d+(?=Z$|[+-]\d{2}:\d{2}$)/, '');
}

function clockFromIso(iso) {
  const match = /T(\d{2}:\d{2}:\d{2})/.exec(String(iso));
  return match ? match[1] : null;
}

function diffMs(laterIso, earlierIso) {
  if (!laterIso || !earlierIso) {
    return null;
  }

  const laterMs = Date.parse(laterIso);
  const earlierMs = Date.parse(earlierIso);

  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return null;
  }

  return laterMs - earlierMs;
}

module.exports = {
  toIsoUtc,
  toLocalIso,
  getNowIso,
  stripMs,
  clockFromIso,
  diffMs
};
