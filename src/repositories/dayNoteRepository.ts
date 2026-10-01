import { DayNote } from '../models/DayNote';
import { IDayNote } from '../types';

export class DayNoteRepository {
  static async findForUser(userId: string): Promise<IDayNote[]> {
    return DayNote.find({ userId, deletedAt: null })
      .sort({ date: 1 })
      .lean() as unknown as Promise<IDayNote[]>;
  }

  static async findForUserInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IDayNote[]> {
    return DayNote.find({
      userId,
      deletedAt: null,
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: 1 })
      .lean() as unknown as Promise<IDayNote[]>;
  }

  static async findByDate(userId: string, date: Date): Promise<IDayNote | null> {
    return DayNote.findOne({ userId, date, deletedAt: null }).lean() as unknown as Promise<
      IDayNote | null
    >;
  }

  static async findById(id: string): Promise<IDayNote | null> {
    return DayNote.findById(id).lean() as unknown as Promise<IDayNote | null>;
  }

  static async create(data: Partial<IDayNote>): Promise<IDayNote> {
    const doc = await DayNote.create(data);
    return doc.toObject() as unknown as IDayNote;
  }

  static async update(id: string, updates: Partial<IDayNote>): Promise<IDayNote | null> {
    return DayNote.findByIdAndUpdate(id, updates, { new: true }).lean() as unknown as Promise<
      IDayNote | null
    >;
  }

  /**
   * There is at most one note per user per day, so writes target the (user, date)
   * pair rather than an id. Reviving a soft-deleted row keeps the unique index
   * happy when a cleared note is re-added for the same day.
   */
  static async upsertByDate(data: {
    _id: string;
    userId: string;
    date: Date;
    notes: string;
  }): Promise<IDayNote> {
    const doc = await DayNote.findOneAndUpdate(
      { userId: data.userId, date: data.date },
      { ...data, deletedAt: null, updatedAt: new Date() },
      { upsert: true, new: true }
    ).lean();
    return doc as unknown as IDayNote;
  }

  static async softDeleteByDate(userId: string, date: Date): Promise<IDayNote | null> {
    return DayNote.findOneAndUpdate(
      { userId, date, deletedAt: null },
      { deletedAt: new Date(), updatedAt: new Date() },
      { new: true }
    ).lean() as unknown as Promise<IDayNote | null>;
  }
}