import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

export const createCsrfToken = (): string => randomBytes(32).toString('hex');

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const expected = req.session.csrfToken;
  const supplied = req.get('X-CSRF-Token');
  if (!expected || !supplied || !/^[a-f0-9]{64}$/.test(supplied)
    || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'))) {
    return next(new AppError(403, 'CSRF_INVALID', 'Phiên xác thực đã thay đổi. Vui lòng thử lại.'));
  }
  next();
};
