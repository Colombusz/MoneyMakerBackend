import { Schema, model } from 'mongoose';
import { IRecurringRule } from '../types';

const recurringRuleSchema = new Schema<IRecurringRule>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    accountId: { type: String, required: true },
    categoryId: { type: String, required: true },
    type: { type: String, enum: ['expense', 'income'], default: 'expense' },
    amountCentavos: { type: Number, required: true },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
      required: true
    },
    intervalDays: { type: Number, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    maxOccurrences: { type: Number, default: null },
    notes: { type: String, default: '' },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

recurringRuleSchema.index({ userId: 1, updatedAt: 1 });

export const RecurringRule = model<IRecurringRule>('RecurringRule', recurringRuleSchema);
