import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelative } from './formatTime.js';

describe('formatRelative', () => {
  beforeEach(() => {
    // Freeze "now" to 2026-04-19 12:00:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  test('empty input returns empty string', () => {
    expect(formatRelative('')).toBe('');
    expect(formatRelative(null)).toBe('');
    expect(formatRelative(undefined)).toBe('');
  });

  test('returns raw string on unparseable input', () => {
    expect(formatRelative('not-a-date')).toBe('not-a-date');
  });

  test('just now (< 30 seconds)', () => {
    expect(formatRelative('2026-04-19T11:59:50Z')).toBe('just now');
  });

  test('minutes ago', () => {
    expect(formatRelative('2026-04-19T11:55:00Z')).toBe('5m ago');
    expect(formatRelative('2026-04-19T11:01:00Z')).toBe('59m ago');
  });

  test('hours ago', () => {
    expect(formatRelative('2026-04-19T09:00:00Z')).toBe('3h ago');
    expect(formatRelative('2026-04-18T13:00:00Z')).toBe('23h ago');
  });

  test('yesterday', () => {
    expect(formatRelative('2026-04-18T11:00:00Z')).toBe('昨天');
  });

  test('N days ago (< 7)', () => {
    expect(formatRelative('2026-04-16T12:00:00Z')).toBe('3d ago');
  });

  test('>= 7 days returns MM-DD', () => {
    expect(formatRelative('2026-04-10T12:00:00Z')).toBe('04-10');
  });

  test('naive UTC without Z suffix is treated as UTC (no 8-hour drift)', () => {
    // Backend emits `datetime.utcnow().isoformat()` with no timezone.
    // If we accidentally parse as local, we'd see "8h ago" in Asia/Taipei.
    // formatRelative must append Z before parsing.
    expect(formatRelative('2026-04-19T11:55:00')).toBe('5m ago');
  });

  test('string with explicit +offset is respected as-is', () => {
    // 12:00 UTC+8 === 04:00 UTC → 8 hours ago from 12:00 UTC.
    expect(formatRelative('2026-04-19T12:00:00+08:00')).toBe('8h ago');
  });
});
