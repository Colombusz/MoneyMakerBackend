import { Router } from 'express';
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  getOccurrences,
  payOccurrence,
  skipOccurrence
} from '../controllers/recurringController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  occurrencesQuerySchema,
  payOccurrenceSchema,
  skipOccurrenceSchema
} from './recurringValidation';

const router = Router();

router.use(authenticateToken);

// Support both /api/recurring and /api/recurring/rules
router.get('/', getRecurringRules);
router.get('/rules', getRecurringRules);

router.post('/', validateRequest({ body: createRecurringRuleSchema }), createRecurringRule);
router.post('/rules', validateRequest({ body: createRecurringRuleSchema }), createRecurringRule);

router.put('/:id', validateRequest({ body: updateRecurringRuleSchema }), updateRecurringRule);
router.put('/rules/:id', validateRequest({ body: updateRecurringRuleSchema }), updateRecurringRule);

router.delete('/:id', deleteRecurringRule);
router.delete('/rules/:id', deleteRecurringRule);

// Occurrences
router.get('/occurrences', validateRequest({ query: occurrencesQuerySchema }), getOccurrences);
router.post('/occurrences/:id/pay', validateRequest({ body: payOccurrenceSchema }), payOccurrence);
router.post('/occurrences/pay', validateRequest({ body: payOccurrenceSchema }), payOccurrence);
router.post(
  '/occurrences/:id/skip',
  validateRequest({ body: skipOccurrenceSchema }),
  skipOccurrence
);
router.post('/occurrences/skip', validateRequest({ body: skipOccurrenceSchema }), skipOccurrence);

export default router;
