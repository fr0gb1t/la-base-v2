import { describe, expect, it } from 'vitest';
import { unseenCount, type Novedad } from './novedades';

const entry = (id: string): Novedad => ({ id, date: '2026-10-04', title: id, items: ['x'] });
const entries = [entry('c'), entry('b'), entry('a')]; // newest first

describe('unseenCount', () => {
  it('counts the entries newer than the last one seen', () => {
    expect(unseenCount(entries, 'b')).toBe(1);
    expect(unseenCount(entries, 'a')).toBe(2);
  });

  it('is zero when the newest was seen', () => {
    expect(unseenCount(entries, 'c')).toBe(0);
  });

  it('counts everything for someone who never opened it, or whose last seen entry is gone', () => {
    expect(unseenCount(entries, null)).toBe(3);
    expect(unseenCount(entries, 'removed')).toBe(3);
  });

  it('is zero with no entries', () => {
    expect(unseenCount([], null)).toBe(0);
  });
});
