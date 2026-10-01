import { Schema, model } from 'mongoose';
import { ICategory } from '../types';

const categorySchema = new Schema<ICategory>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    icon: { type: String, default: 'tag' },
    color: { type: String, default: '#3B82F6' },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ userId: 1, updatedAt: 1 });

export const Category = model<ICategory>('Category', categorySchema);
