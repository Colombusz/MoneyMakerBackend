import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthSummary
} from '../controllers/transactionController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  createTransactionSchema,
  updateTransactionSchema,
  monthSummaryQuerySchema
} from './transactionValidation';

const router = Router();

router.use(authenticateToken);

router.get('/', getTransactions);
router.get('/month-summary', validateRequest({ query: monthSummaryQuerySchema }), getMonthSummary);
router.get('/:id', getTransactionById);
router.post('/', validateRequest({ body: createTransactionSchema }), createTransaction);
router.put('/:id', validateRequest({ body: updateTransactionSchema }), updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
