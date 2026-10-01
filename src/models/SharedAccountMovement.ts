import { Schema, model } from 'mongoose';
import { ISharedAccountMovement } from '../types';

const sharedAccountMovementSchema = new Schema<ISharedAccountMovement>(
  {
    _id: { type: String, required: true },
    sharedAccountId: { type: String, required: true, index: true },
    type: { type: String, enum: ['deposit', 'expense'], required: true },
    userId: { type: String, required: true, index: true },
    amountCentavos: { type: Number, required: true },
    privateAccountId: { type: String, default: null },
    privateTransactionId: { type: String, default: null },
    date: { type: Date, required: true },
    notes: { type: String, default: '' },
    categoryId: { type: String, default: null },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

sharedAccountMovementSchema.index({ sharedAccountId: 1, date: -1 });

export const SharedAccountMovement = model<ISharedAccountMovement>(
  'SharedAccountMovement',
  sharedAccountMovementSchema
);
