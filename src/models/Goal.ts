import { Schema, model } from 'mongoose';
import { IGoal } from '../types';

const goalSchema = new Schema<IGoal>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetAmountCentavos: { type: Number, required: true },
    targetDate: { type: Date, default: null },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    linkedAccountId: { type: String, default: null },
    isShared: { type: Boolean, default: false },
    sharedGoalId: { type: String, default: null, index: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

goalSchema.index({ userId: 1, updatedAt: 1 });

export const Goal = model<IGoal>('Goal', goalSchema);
