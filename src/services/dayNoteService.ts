import { uuidv4 } from '../utils/uuid';
import { DayNoteRepository } from '../repositories/dayNoteRepository';
import { AppError } from '../errors/AppError';

const formatNote = (n: any) => ({
  id: n._id || n.id,
  userId: n.userId,
  date: n.date,
  notes: n.notes,
  updatedAt: n.updatedAt
});

/**
 * Normalise an incoming date to UTC midnight.
 *
 * Clients may send either a calendar key ('2026-10-05') or a full timestamp. The
 * calendar groups by the UTC calendar date, so pinning every note to UTC midnight
 * keeps "the note for the 5th" a single, stable row instead of drifting across
 * days when different clients write slightly different times for the same day.
 */
export const toUtcMidnight = (value: string | Date): Date => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest('Invalid date');
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
};

export class DayNoteService {
  static async listNotes(userId: string) {
    const notes = await DayNoteRepository.findForUser(userId);
    return notes.map(formatNote);
  }

  static async listNotesInRange(userId: string, startStr: string, endStr: string) {
    const start = toUtcMidnight(startStr);
    // Widen the end bound so a full timestamp passed for the end day is included.
    const end = new Date(toUtcMidnight(endStr).getTime() + 24 * 60 * 60 * 1000 - 1);
    const notes = await DayNoteRepository.findForUserInRange(userId, start, end);
    return notes.map(formatNote);
  }

  static async getNoteByDate(userId: string, dateStr: string) {
    const note = await DayNoteRepository.findByDate(userId, toUtcMidnight(dateStr));
    return note ? formatNote(note) : null;
  }

  static async saveNote(userId: string, dateStr: string, notes: string) {
    const date = toUtcMidnight(dateStr);
    const trimmed = (notes ?? '').trim();

    // Clearing the text removes the row rather than storing an empty note, so the
    // calendar does not render a meaningless empty note marker.
    if (!trimmed) {
      await DayNoteRepository.softDeleteByDate(userId, date);
      return null;
    }

    const saved = await DayNoteRepository.upsertByDate({
      _id: uuidv4(),
      userId,
      date,
      notes: trimmed
    });
    return formatNote(saved);
  }
}