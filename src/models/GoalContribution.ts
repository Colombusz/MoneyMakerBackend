import { Schema, model } from 'mongoose';
import { IGoalContribution } from '../types';

const goalContributionSchema = new Schema<IGoalContribution>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    goalId: { type: String, default: null, index: true },
    sharedGoalId: { type: String, default: null, index: true },
    amountCentavos: { type: Number, required: true },
    transactionId: { type: String, default: null },
    date: { type: Date, required: true },
    notes: { type: String, default: '' },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

goalContributionSchema.index({ goalId: 1, date: -1 });
goalContributionSchema.index({ sharedGoalId: 1, date: -1 });

export const GoalContribution = model<IGoalContribution>(
  'GoalContribution',
  goalContributionSchema
);
