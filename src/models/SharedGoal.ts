import { Schema, model } from 'mongoose';
import { ISharedGoal } from '../types';

const sharedGoalMemberSchema = new Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'left'], default: 'active' }
  },
  { _id: false }
);

const sharedGoalSchema = new Schema<ISharedGoal>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    targetAmountCentavos: { type: Number, required: true },
    targetDate: { type: Date, default: null },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    createdByUserId: { type: String, required: true, index: true },
    members: { type: [sharedGoalMemberSchema], default: [] },
    isArchived: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

sharedGoalSchema.index({ 'members.userId': 1 });

export const SharedGoal = model<ISharedGoal>('SharedGoal', sharedGoalSchema);
