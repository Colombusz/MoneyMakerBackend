import { Schema, model } from 'mongoose';
import { IVacation } from '../types';

const vacationMemberSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['master', 'member'], required: true },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const vacationSchema = new Schema<IVacation>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    joinCode: { type: String, required: true, unique: true, index: true },
    creatorUserId: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'concluded'], default: 'active', index: true },
    members: { type: [vacationMemberSchema], default: [] },
    balanceCentavos: { type: Number, required: true, default: 0 },
    concludedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

vacationSchema.index({ 'members.userId': 1 });

export const Vacation = model<IVacation>('Vacation', vacationSchema);
