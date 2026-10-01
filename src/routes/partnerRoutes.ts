import { Router } from 'express';
import {
  generateInvite,
  acceptInvite,
  unlinkPartner,
  getPartnerStatus,
  getSharedGoals,
  getSharedGoalById,
  createSharedGoal,
  contributeToSharedGoal,
  leaveSharedGoal
} from '../controllers/partnerController';
import {
  getSharedAccounts,
  getSharedAccountById,
  createSharedAccount,
  depositToSharedAccount,
  recordSharedAccountExpense
} from '../controllers/sharedAccountController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  acceptInviteSchema,
  createSharedGoalSchema,
  contributeSharedGoalSchema,
  createSharedAccountSchema,
  depositSharedAccountSchema,
  expenseSharedAccountSchema
} from './partnerValidation';

const router = Router();

router.use(authenticateToken);

// Partner pairing routes
router.post('/invite', generateInvite);
router.post('/accept', validateRequest({ body: acceptInviteSchema }), acceptInvite);
router.post('/unlink', unlinkPartner);
router.get('/status', getPartnerStatus);

// Shared goals routes (Strict isolation)
router.get('/shared-goals', getSharedGoals);
router.get('/shared-goals/:id', getSharedGoalById);
router.post('/shared-goals', validateRequest({ body: createSharedGoalSchema }), createSharedGoal);
router.post(
  '/shared-goals/:id/contribute',
  validateRequest({ body: contributeSharedGoalSchema }),
  contributeToSharedGoal
);
router.post('/shared-goals/:id/leave', leaveSharedGoal);

// Shared accounts routes (Strict isolation: privateAccountId never exposed cross-member)
router.get('/shared-accounts', getSharedAccounts);
router.get('/shared-accounts/:id', getSharedAccountById);
router.post('/shared-accounts', validateRequest({ body: createSharedAccountSchema }), createSharedAccount);
router.post(
  '/shared-accounts/:id/deposit',
  validateRequest({ body: depositSharedAccountSchema }),
  depositToSharedAccount
);
router.post(
  '/shared-accounts/:id/expense',
  validateRequest({ body: expenseSharedAccountSchema }),
  recordSharedAccountExpense
);

export default router;
