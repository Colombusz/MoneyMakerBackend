import { Router } from 'express';
import { syncPush, syncPull } from '../controllers/syncController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { syncPushSchema, syncPullQuerySchema } from './syncValidation';

const router = Router();

router.use(authenticateToken);

router.post('/push', validateRequest({ body: syncPushSchema }), syncPush);
router.get('/pull', validateRequest({ query: syncPullQuerySchema }), syncPull);

export default router;
