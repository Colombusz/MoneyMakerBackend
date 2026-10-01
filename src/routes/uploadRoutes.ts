import { Router } from 'express';
import { getUploadSignature } from '../controllers/uploadController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/sign', getUploadSignature);

export default router;
