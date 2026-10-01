import { Router } from 'express';
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  transferBetweenAccounts
} from '../controllers/accountController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createAccountSchema, updateAccountSchema, transferSchema } from './accountValidation';

const router = Router();

router.use(authenticateToken);

router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/', validateRequest({ body: createAccountSchema }), createAccount);
router.post('/transfer', validateRequest({ body: transferSchema }), transferBetweenAccounts);
router.put('/:id', validateRequest({ body: updateAccountSchema }), updateAccount);
router.delete('/:id', deleteAccount);

export default router;
