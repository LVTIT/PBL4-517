import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { createCsrfToken } from '../middleware/csrf.js';
import { cookieName, cookieOptions, destroySession, regenerateSession, saveSession } from '../middleware/session.js';
import { authenticate, findCurrentUser } from '../services/auth-service.js';

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

export const getCsrf: RequestHandler = async (req, res) => {
  req.session.csrfToken ??= createCsrfToken();
  await saveSession(req);
  res.json({ data: { csrfToken: req.session.csrfToken } });
};

export const login: RequestHandler = async (req, res) => {
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = loginSchema.safeParse(req.body as unknown);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Email không hợp lệ hoặc mật khẩu phải có 8–72 ký tự (tối đa 72 byte).');
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.csrfToken = createCsrfToken();
  await saveSession(req);
  res.json({ data: { user } });
};

export const logout: RequestHandler = async (req, res) => {
  await destroySession(req);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ data: { user: null } });
};

export const getMe: RequestHandler = async (req, res) => {
  const user = req.session.userId ? await findCurrentUser(req.session.userId) : null;
  if (req.session.userId && !user) {
    await destroySession(req);
    res.clearCookie(cookieName, cookieOptions);
  }
  res.json({ data: { user } });
};
