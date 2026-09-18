import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { createCsrfToken } from '../middleware/csrf.js';
import { cookieName, cookieOptions, destroySession, regenerateSession, saveSession } from '../middleware/session.js';
import { authenticate, changePassword, findCurrentUser, registerUser, updateProfile } from '../services/auth-service.js';

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

const registerSchema = z.strictObject({
  name: z.string().trim().min(1, 'Họ tên không được để trống.').max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8, 'Mật khẩu phải từ 8 đến 72 ký tự.').max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(1, 'Họ tên không được để trống.').max(100),
});

const changePasswordSchema = z.strictObject({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải từ 8 đến 72 ký tự.').max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

export const getCsrf: RequestHandler = async (req, res) => {
  req.session.csrfToken ??= createCsrfToken();
  await saveSession(req);
  res.json({ data: { csrfToken: req.session.csrfToken } });
};

export const register: RequestHandler = async (req, res) => {
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = registerSchema.safeParse(req.body as unknown);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dữ liệu đăng ký không hợp lệ.';
    throw new AppError(400, 'INVALID_INPUT', message);
  }
  const user = await registerUser(parsed.data.name, parsed.data.email, parsed.data.password);
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.csrfToken = createCsrfToken();
  await saveSession(req);
  res.status(201).json({ data: { user } });
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

export const updateProfileController: RequestHandler = async (req, res) => {
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để thực hiện thao tác này.');
  }
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = updateProfileSchema.safeParse(req.body as unknown);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  }
  const user = await updateProfile(req.session.userId, parsed.data.name);
  res.json({ data: { user } });
};

export const changePasswordController: RequestHandler = async (req, res) => {
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để thực hiện thao tác này.');
  }
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = changePasswordSchema.safeParse(req.body as unknown);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  }
  await changePassword(req.session.userId, parsed.data.oldPassword, parsed.data.newPassword);
  res.json({ data: { success: true, message: 'Đổi mật khẩu thành công.' } });
};
