import { Schema, model } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    currency: { type: String, default: 'PHP' },
    partnerId: { type: String, default: null, ref: 'User' },
    refreshTokenHash: { type: String, default: null },
    refreshTokenHashes: { type: [String], default: [] }
  },
  {
    timestamps: true
  }
);

export const User = model<IUser>('User', userSchema);
