import { Schema, model } from 'mongoose';
import { ISharedAccount } from '../types';

const sharedAccountMemberSchema = new Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'left'], default: 'active' }
  },
  { _id: false }
);

const sharedAccountSchema = new Schema<ISharedAccount>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    createdByUserId: { type: String, required: true, index: true },
    members: { type: [sharedAccountMemberSchema], default: [] },
    isArchived: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

sharedAccountSchema.index({ 'members.userId': 1 });

export const SharedAccount = model<ISharedAccount>('SharedAccount', sharedAccountSchema);
