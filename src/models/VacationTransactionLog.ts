import { Schema, model } from 'mongoose';
import { IVacationTransactionLog } from '../types';

const vacationTransactionLogSchema = new Schema<IVacationTransactionLog>(
  {
    _id: { type: String, required: true },
    vacationId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['deposit', 'expense', 'chip_in', 'refund', 'reversal', 'concluded'],
      required: true
    },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    amountCentavos: { type: Number, required: true },
    description: { type: String, required: true },
    relatedItemId: { type: String, default: null },
    date: { type: Date, required: true, default: Date.now },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

vacationTransactionLogSchema.index({ vacationId: 1, date: -1 });

export const VacationTransactionLog = model<IVacationTransactionLog>(
  'VacationTransactionLog',
  vacationTransactionLogSchema
);
