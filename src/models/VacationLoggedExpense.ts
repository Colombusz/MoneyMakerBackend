import { Schema, model } from 'mongoose';
import { IVacationLoggedExpense } from '../types';

const vacationLoggedExpenseSchema = new Schema<IVacationLoggedExpense>(
  {
    _id: { type: String, required: true },
    vacationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    amountCentavos: { type: Number, required: true },
    category: { type: String, default: null },
    fromAccountId: { type: String, default: null },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

vacationLoggedExpenseSchema.index({ vacationId: 1, userId: 1 });

export const VacationLoggedExpense = model<IVacationLoggedExpense>(
  'VacationLoggedExpense',
  vacationLoggedExpenseSchema
);
