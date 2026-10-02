import { Schema, model } from 'mongoose';
import { IVacationChipIn } from '../types';

const vacationChipInContributionSchema = new Schema(
  {
    _id: { type: String, required: true },
    chipInId: { type: String, required: true },
    vacationId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    amountCentavos: { type: Number, required: true },
    fromAccountId: { type: String, default: null },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const vacationChipInSchema = new Schema<IVacationChipIn>(
  {
    _id: { type: String, required: true },
    vacationId: { type: String, required: true, index: true },
    createdByUserId: { type: String, required: true },
    createdByName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    targetAmountCentavos: { type: Number, default: null },
    totalCollectedCentavos: { type: Number, required: true, default: 0 },
    totalSpentCentavos: { type: Number, required: true, default: 0 },
    totalRefundedCentavos: { type: Number, required: true, default: 0 },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    contributions: { type: [vacationChipInContributionSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

vacationChipInSchema.index({ vacationId: 1 });

export const VacationChipIn = model<IVacationChipIn>('VacationChipIn', vacationChipInSchema);
