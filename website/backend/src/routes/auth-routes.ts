import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getCsrf, getMe, login, logout } from '../controllers/auth-controller.js';
import { csrfProtection } from '../middleware/csrf.js';
import { sessionMiddleware } from '../middleware/session.js';

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' } },
});

authRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// Limit before accessing the session store or calculating password hashes.
authRoutes.post('/login', loginLimiter);
authRoutes.use(sessionMiddleware, csrfProtection);
authRoutes.get('/csrf', getCsrf);
authRoutes.get('/me', getMe);
authRoutes.post('/login', login);
authRoutes.post('/logout', logout);
