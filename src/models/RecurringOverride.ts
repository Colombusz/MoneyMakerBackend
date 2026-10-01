import { Schema, model } from 'mongoose';
import { IRecurringOverride } from '../types';

const recurringOverrideSchema = new Schema<IRecurringOverride>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    recurringRuleId: { type: String, required: true, index: true },
    occurrenceDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['skipped', 'paid', 'modified'],
      required: true
    },
    overrideAmountCentavos: { type: Number, default: null },
    transactionId: { type: String, default: null },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

recurringOverrideSchema.index({ userId: 1, recurringRuleId: 1, occurrenceDate: 1 });

export const RecurringOverride = model<IRecurringOverride>(
  'RecurringOverride',
  recurringOverrideSchema
);
