import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { findCurrentUser } from '../services/auth-service.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.'));
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  if (!req.session.userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.'));
  }
  const user = await findCurrentUser(req.session.userId);
  if (!user || user.role !== 'ADMIN') {
    return next(new AppError(403, 'FORBIDDEN', 'Yêu cầu quyền Quản trị viên (ADMIN) để thực hiện thao tác này.'));
  }
  next();
};
