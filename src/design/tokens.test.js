import { describe, test, expect } from 'vitest';
import { weekCode, weekCodeRange } from './tokens.js';

describe('weekCode', () => {
  test('returns empty string for falsy input', () => {
    expect(weekCode('')).toBe('');
    expect(weekCode(null)).toBe('');
    expect(weekCode(undefined)).toBe('');
  });

  test('ISO 8601 week for a Monday', () => {
    // 2026-04-13 is the Monday of ISO week 16.
    expect(weekCode('2026-04-13')).toBe('W616');
  });

  test('ISO 8601 week for a Sunday stays in same week', () => {
    // 2026-04-19 (Sun) is still ISO week 16.
    expect(weekCode('2026-04-19')).toBe('W616');
  });

  test('ISO year boundary early January', () => {
    // 2026-01-01 (Thu) belongs to ISO year 2026 week 1.
    expect(weekCode('2026-01-01')).toBe('W601');
    // 2025-12-29 is ISO 2026 week 1 (week starts Mon of prior year).
    expect(weekCode('2025-12-29')).toBe('W601');
  });

  test('ISO year boundary late December', () => {
    // 2024-12-30 is ISO 2025 W01.
    expect(weekCode('2024-12-30')).toBe('W501');
  });

  test('MM-DD form uses DEFAULT_YEAR', () => {
    // No year: uses 2026.
    expect(weekCode('04-13')).toBe('W616');
  });

  test('fallbackYear override wins over DEFAULT_YEAR', () => {
    expect(weekCode('04-13', 2027)).toBe('W715');
  });
});

describe('weekCodeRange', () => {
  test('same week collapses to single code', () => {
    expect(weekCodeRange('2026-04-13', '2026-04-17')).toBe('W616');
  });

  test('same year abbreviates to W616–17', () => {
    expect(weekCodeRange('2026-04-13', '2026-04-20')).toBe('W616–17');
  });

  test('across ISO years uses full arrow', () => {
    // 2024-12-30 is ISO 2025 W01 (year digit 5); 2026-01-05 is ISO 2026 W02.
    // Different year digit → full arrow form.
    expect(weekCodeRange('2024-12-30', '2026-01-05')).toBe('W501→W602');
  });

  test('missing start returns end code', () => {
    expect(weekCodeRange('', '2026-04-13')).toBe('W616');
  });

  test('missing end returns start code', () => {
    expect(weekCodeRange('2026-04-13', '')).toBe('W616');
  });
});
