import { Schema, model } from 'mongoose';
import { IVacationExpenseItem } from '../types';

const vacationExpenseItemSchema = new Schema<IVacationExpenseItem>(
  {
    _id: { type: String, required: true },
    vacationId: { type: String, required: true, index: true },
    createdByUserId: { type: String, required: true, index: true },
    createdByName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    amountCentavos: { type: Number, required: true },
    category: { type: String, default: null },
    deductionSource: { type: String, enum: ['pool', 'chip_in'], default: 'pool' },
    chipInId: { type: String, default: null },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

vacationExpenseItemSchema.index({ vacationId: 1, date: -1 });

export const VacationExpenseItem = model<IVacationExpenseItem>(
  'VacationExpenseItem',
  vacationExpenseItemSchema
);
