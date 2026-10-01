import { Schema, model } from 'mongoose';
import { IDayNote } from '../types';

const dayNoteSchema = new Schema<IDayNote>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    notes: { type: String, default: '' },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

// One note per user per day. The partial filter keeps a cleared (soft-deleted)
// note from blocking a fresh one for the same date.
dayNoteSchema.index(
  { userId: 1, date: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const DayNote = model<IDayNote>('DayNote', dayNoteSchema);