import { Schema, model } from 'mongoose';
import { IAccount } from '../types';

const accountSchema = new Schema<IAccount>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['savings', 'payroll', 'goals', 'cash', 'other'],
      required: true
    },
    startingBalanceCentavos: { type: Number, required: true, default: 0 },
    currentBalanceCentavos: { type: Number, required: true, default: 0 },
    isArchived: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, index: true }
  },
  {
    timestamps: true
  }
);

accountSchema.index({ userId: 1, updatedAt: 1 });

export const Account = model<IAccount>('Account', accountSchema);
