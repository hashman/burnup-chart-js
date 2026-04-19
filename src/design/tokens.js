// Design tokens — Linear/Height-inspired, light, high-density.
// Ported from new-burnup-design/project/screens/tokens.js.
// Exported as ES modules instead of window globals.

export const T = {
  bg:       '#FAFAF9',
  surface:  '#FFFFFF',
  surface2: '#F5F5F4',
  border:   '#E7E5E4',
  borderStrong: '#D6D3D1',
  divider:  '#F5F5F4',

  text:     '#18181B',
  textMute: '#52525B',
  textDim:  '#A1A1AA',
  textFaint:'#D4D4D8',

  iris:     '#5B5BD6',
  irisSoft: '#EEF0FE',
  irisDim:  '#C9CDFF',
  green:    '#2DA44E',
  greenSoft:'#EAF6EC',

  warn:     '#D97706',
  warnSoft: '#FEF3C7',
  danger:   '#DC2626',
  dangerSoft:'#FEE2E2',
  violet:   '#7C3AED',
  violetSoft:'#F3EEFE',

  today:    '#F59E0B',

  r1: 4, r2: 6, r3: 8, r4: 10,
};

export const FONT = `"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif`;
export const MONO = `"Geist Mono", "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace`;

export const DEFAULT_YEAR = 2026;

export function weekCode(dateStr, fallbackYear) {
  if (!dateStr) return '';
  const y = fallbackYear ?? DEFAULT_YEAR;
  const parts = String(dateStr).split('-').map(Number);
  const [yy, mm, dd] = parts.length === 3 ? parts : [y, parts[0], parts[1]];
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  const isoYear = d.getUTCFullYear();
  return 'W' + (isoYear % 10) + String(week).padStart(2, '0');
}

export function weekCodeRange(startStr, endStr, fallbackYear) {
  const a = weekCode(startStr, fallbackYear);
  const b = weekCode(endStr, fallbackYear);
  if (!a) return b;
  if (!b || a === b) return a;
  if (a[1] === b[1]) return a + '–' + b.slice(2);
  return a + '→' + b;
}
