import { describe, expect, it } from 'vitest';
import { groupByDate, unseenCount, type Novedad } from './novedades';

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

describe('groupByDate', () => {
  const on = (id: string, date: string): Novedad => ({ ...entry(id), date });

  it('groups the entries of the same day, newest day first', () => {
    const days = groupByDate([on('d', '2026-10-04'), on('c', '2026-10-04'), on('b', '2026-10-03'), on('a', '2026-09-30')]);
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-03', '2026-09-30']);
    expect(days[0].entries.map((e) => e.id)).toEqual(['d', 'c']);
  });

  it('is empty with no entries', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
