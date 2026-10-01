import { toUtcMidnight } from '../../src/services/dayNoteService';

describe('toUtcMidnight', () => {
  // The calendar buckets by `toISOString().split('T')[0]`, so every day note has
  // to normalise to the same UTC instant or it would drift across days depending
  // on which client wrote it.
  it('treats a bare YYYY-MM-DD as UTC midnight', () => {
    expect(toUtcMidnight('2026-10-05').toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('normalises any timestamp on the same UTC day to the same instant', () => {
    const morning = toUtcMidnight('2026-10-05T01:30:00.000Z');
    const evening = toUtcMidnight('2026-10-05T23:45:00.000Z');
    expect(morning.toISOString()).toBe(evening.toISOString());
  });

  it('keeps distinct days distinct', () => {
    expect(toUtcMidnight('2026-10-05').getTime()).not.toBe(
      toUtcMidnight('2026-10-06').getTime()
    );
  });

  it('handles month and year boundaries without rolling over', () => {
    expect(toUtcMidnight('2026-01-01').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toUtcMidnight('2026-12-31').toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('rejects an unparseable date', () => {
    expect(() => toUtcMidnight('not-a-date')).toThrow('Invalid date');
  });
});
