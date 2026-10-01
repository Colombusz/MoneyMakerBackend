import { Schema, model } from 'mongoose';
import { ITransaction } from '../types';

const transactionSchema = new Schema<ITransaction>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    accountId: { type: String, required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    amountCentavos: { type: Number, required: true },
    categoryId: { type: String, default: null, index: true },
    source: { type: String, default: null },
    destinationAccountId: { type: String, default: null },
    date: { type: Date, required: true, index: true },
    notes: { type: String, default: '' },
    receiptImageUrl: { type: String, default: null },
    receiptPublicId: { type: String, default: null },
    recurringRuleId: { type: String, default: null },
    recurringOccurrenceDate: { type: Date, default: null },
    goalId: { type: String, default: null },
    sharedAccountId: { type: String, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, updatedAt: 1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
