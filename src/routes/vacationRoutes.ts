import { Router } from 'express';
import {
  createVacation,
  joinVacation,
  getActiveVacations,
  getPastVacations,
  getVacationById,
  getPastVacationSummary,
  depositToVacation,
  createExpenseItem,
  logPersonalExpense,
  createChipIn,
  contributeChipIn,
  refundVacation,
  reverseLog,
  concludeVacation
} from '../controllers/vacationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  createVacationSchema,
  joinVacationSchema,
  depositVacationSchema,
  createExpenseItemSchema,
  logPersonalExpenseSchema,
  createChipInSchema,
  contributeChipInSchema,
  refundVacationSchema,
  reverseLogSchema
} from './vacationValidation';

const router = Router();

router.use(authenticateToken);

// List vacations
router.get('/', getActiveVacations);
router.get('/past', getPastVacations);

// Create and Join
router.post('/', validateRequest({ body: createVacationSchema }), createVacation);
router.post('/join', validateRequest({ body: joinVacationSchema }), joinVacation);

// Single vacation details & past summary
router.get('/:id', getVacationById);
router.get('/:id/past-summary', getPastVacationSummary);

// Funding & spending actions
router.post(
  '/:id/deposit',
  validateRequest({ body: depositVacationSchema }),
  depositToVacation
);

router.post(
  '/:id/expense-items',
  validateRequest({ body: createExpenseItemSchema }),
  createExpenseItem
);

router.post(
  '/:id/logged-expenses',
  validateRequest({ body: logPersonalExpenseSchema }),
  logPersonalExpense
);

router.post(
  '/:id/chip-ins',
  validateRequest({ body: createChipInSchema }),
  createChipIn
);

router.post(
  '/:id/chip-ins/:chipInId/contribute',
  validateRequest({ body: contributeChipInSchema }),
  contributeChipIn
);

router.post(
  '/:id/refund',
  validateRequest({ body: refundVacationSchema }),
  refundVacation
);

router.post(
  '/:id/reversal',
  validateRequest({ body: reverseLogSchema }),
  reverseLog
);

router.post('/:id/conclude', concludeVacation);

export default router;
