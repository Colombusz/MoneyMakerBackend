import { Router } from 'express';
import {
  listDayNotes,
  getDayNote,
  saveDayNote,
  deleteDayNote
} from '../controllers/dayNoteController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  saveDayNoteSchema,
  dayNoteQuerySchema,
  dayNoteParamSchema
} from './dayNoteValidation';

const router = Router();

router.use(authenticateToken);

router.get('/', validateRequest({ query: dayNoteQuerySchema }), listDayNotes);
router.get('/:date', validateRequest({ params: dayNoteParamSchema }), getDayNote);

// Saving is an upsert keyed on the calendar day, so there is no id to address.
router.put('/:date', validateRequest({ params: dayNoteParamSchema, body: saveDayNoteSchema }), saveDayNote);
router.post('/', validateRequest({ body: saveDayNoteSchema }), saveDayNote);
router.delete('/:date', validateRequest({ params: dayNoteParamSchema }), deleteDayNote);

export default router;