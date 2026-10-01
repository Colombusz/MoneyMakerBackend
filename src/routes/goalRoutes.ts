import { Router } from 'express';
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal
} from '../controllers/goalController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createGoalSchema, updateGoalSchema, contributeGoalSchema } from './goalValidation';

const router = Router();

router.use(authenticateToken);

router.get('/', getGoals);
router.get('/:id', getGoalById);
router.post('/', validateRequest({ body: createGoalSchema }), createGoal);
router.put('/:id', validateRequest({ body: updateGoalSchema }), updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/contribute', validateRequest({ body: contributeGoalSchema }), contributeToGoal);

export default router;
