// Relative time formatter with m/h/d granularity.
// "just now" → "5m ago" → "3h ago" → "2d ago" → "04-15" (date).

// The backend emits ISO strings via `datetime.utcnow().isoformat()`, which
// omits the timezone suffix. Per ECMAScript, JS then parses them as local
// time, producing an 8-hour drift for Asia/Taipei users. Normalize the
// input by appending `Z` if the string carries no explicit timezone.
function parseIsoAsUtc(iso) {
  if (!iso) return null;
  let s = String(iso);
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  // Only append Z to full datetime strings (must contain a `T`).
  if (!hasTz && s.includes('T')) s = s + 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatRelative(iso) {
  if (!iso) return '';
  const d = parseIsoAsUtc(iso);
  if (!d) return iso;
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 30_000) return 'just now';
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days}d ago`;
  return d.toISOString().slice(5, 10);
}
