import { generateOccurrencesForRange } from '../../src/utils/recurringGenerator';
import { IRecurringRule, IRecurringOverride } from '../../src/types';

describe('Recurring Occurrence Generator', () => {
  const baseRule: IRecurringRule = {
    _id: 'rule-1',
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: 'expense',
    amountCentavos: 150000,
    frequency: 'monthly',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date()
  };

  it('generates occurrences for a multi-month range', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-03-31T23:59:59.999Z');

    const occurrences = generateOccurrencesForRange([baseRule], [], start, end);
    expect(occurrences.length).toBe(3);
    expect(occurrences[0].date).toBe('2026-01-01');
    expect(occurrences[1].date).toBe('2026-02-01');
    expect(occurrences[2].date).toBe('2026-03-01');
    expect(occurrences[0].status).toBe('pending');
  });

  it('applies paid and skipped overrides to occurrences', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-28T23:59:59.999Z');

    const overrides: IRecurringOverride[] = [
      {
        _id: 'ov-1',
        userId: 'user-1',
        recurringRuleId: 'rule-1',
        occurrenceDate: new Date('2026-01-01T00:00:00.000Z'),
        status: 'paid',
        overrideAmountCentavos: 160000,
        updatedAt: new Date()
      },
      {
        _id: 'ov-2',
        userId: 'user-1',
        recurringRuleId: 'rule-1',
        occurrenceDate: new Date('2026-02-01T00:00:00.000Z'),
        status: 'skipped',
        updatedAt: new Date()
      }
    ];

    const occurrences = generateOccurrencesForRange([baseRule], overrides, start, end);
    expect(occurrences.length).toBe(2);
    expect(occurrences[0].status).toBe('paid');
    expect(occurrences[0].amountCentavos).toBe(160000);
    expect(occurrences[1].status).toBe('skipped');
  });

  it('respects endDate on recurring rules', () => {
    const ruleWithEnd: IRecurringRule = {
      ...baseRule,
      endDate: new Date('2026-02-15T00:00:00.000Z')
    };
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-04-30T23:59:59.999Z');

    const occurrences = generateOccurrencesForRange([ruleWithEnd], [], start, end);
    expect(occurrences.length).toBe(2);
  });
});
