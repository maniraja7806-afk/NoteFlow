import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { findUserByEmail, login, me, register } from '../controllers/authController';

const router = Router();

router.post(
  '/register',
  authLimiter,
  [
    body('username').isString().trim().isLength({ min: 2, max: 40 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validate,
  login
);

router.get('/me', authenticate, me);
router.get('/users', authenticate, findUserByEmail);

export default router;
