import { Schema, model } from 'mongoose';
import { IPartnerInvite } from '../types';

const partnerInviteSchema = new Schema<IPartnerInvite>(
  {
    _id: { type: String, required: true },
    inviterUserId: { type: String, required: true, index: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'cancelled', 'expired'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

export const PartnerInvite = model<IPartnerInvite>('PartnerInvite', partnerInviteSchema);
