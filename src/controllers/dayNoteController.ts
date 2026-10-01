import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DayNoteService } from '../services/dayNoteService';
import { HTTP_STATUS } from '../constants';

export const listDayNotes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const start = (req.query.start || req.query.startDate) as string | undefined;
    const end = (req.query.end || req.query.endDate) as string | undefined;

    const notes = start && end
      ? await DayNoteService.listNotesInRange(req.userId!, start, end)
      : await DayNoteService.listNotes(req.userId!);

    res.status(HTTP_STATUS.OK).json({ notes });
  } catch (error) {
    next(error);
  }
};

export const getDayNote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const note = await DayNoteService.getNoteByDate(req.userId!, req.params.date as string);
    res.status(HTTP_STATUS.OK).json({ note });
  } catch (error) {
    next(error);
  }
};

export const saveDayNote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { date, notes } = req.body;
    const note = await DayNoteService.saveNote(req.userId!, date, notes);
    res.status(HTTP_STATUS.OK).json({ note });
  } catch (error) {
    next(error);
  }
};

export const deleteDayNote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await DayNoteService.saveNote(req.userId!, req.params.date as string, '');
    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
};