import { IRecurringRule, IRecurringOverride } from '../types';

export interface ProjectedOccurrence {
  ruleId: string;
  date: string; // YYYY-MM-DD
  amountCentavos: number;
  accountId: string;
  categoryId: string;
  type: 'expense' | 'income';
  notes: string;
  status: 'pending' | 'skipped' | 'paid' | 'modified';
  transactionId?: string | null;
}

export const generateOccurrencesForRange = (
  rules: IRecurringRule[],
  overrides: IRecurringOverride[],
  rangeStart: Date,
  rangeEnd: Date
): ProjectedOccurrence[] => {
  const occurrences: ProjectedOccurrence[] = [];

  // Index overrides by `${ruleId}_${dateKey}`
  const overrideMap = new Map<string, IRecurringOverride>();
  for (const ov of overrides) {
    const dateKey = new Date(ov.occurrenceDate).toISOString().split('T')[0];
    overrideMap.set(`${ov.recurringRuleId}_${dateKey}`, ov);
  }

  for (const rule of rules) {
    let current = new Date(rule.startDate);
    const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;
    let count = 0;

    // Safety limit to avoid infinite loops
    const maxIterations = 2000;
    let iteration = 0;

    while (iteration++ < maxIterations) {
      if (ruleEnd && current > ruleEnd) break;
      if (rule.maxOccurrences && count >= rule.maxOccurrences) break;

      // If current occurrence is beyond rangeEnd, we can stop if frequency is forward progressing
      if (current > rangeEnd) break;

      const dateKey = current.toISOString().split('T')[0];
      const isInRange = current >= rangeStart && current <= rangeEnd;

      if (isInRange) {
        const override = overrideMap.get(`${rule._id}_${dateKey}`);
        if (override) {
          occurrences.push({
            ruleId: rule._id,
            date: dateKey,
            amountCentavos:
              override.overrideAmountCentavos !== null &&
              override.overrideAmountCentavos !== undefined
                ? override.overrideAmountCentavos
                : rule.amountCentavos,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type || 'expense',
            notes: rule.notes || '',
            status: override.status,
            transactionId: override.transactionId
          });
        } else {
          occurrences.push({
            ruleId: rule._id,
            date: dateKey,
            amountCentavos: rule.amountCentavos,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type || 'expense',
            notes: rule.notes || '',
            status: 'pending'
          });
        }
      }

      count++;

      // Advance date
      const nextDate = new Date(current);
      switch (rule.frequency) {
        case 'daily':
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
          break;
        case 'weekly':
          nextDate.setUTCDate(nextDate.getUTCDate() + 7);
          break;
        case 'monthly':
          nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
          break;
        case 'yearly':
          nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
          break;
        case 'custom':
          const days = rule.intervalDays && rule.intervalDays > 0 ? rule.intervalDays : 1;
          nextDate.setUTCDate(nextDate.getUTCDate() + days);
          break;
        default:
          nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
          break;
      }
      current = nextDate;
    }
  }

  // Sort occurrences by date ascending
  occurrences.sort((a, b) => a.date.localeCompare(b.date));
  return occurrences;
};
