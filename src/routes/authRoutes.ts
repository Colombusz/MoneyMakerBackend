import { Router } from 'express';
import { register, login, refreshToken, logout, getMe } from '../controllers/authController';
import { authenticateToken, authLimiter } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from './authValidation';

const router = Router();

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), login);
router.post('/refresh', validateRequest({ body: refreshSchema }), refreshToken);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);

export default router;
