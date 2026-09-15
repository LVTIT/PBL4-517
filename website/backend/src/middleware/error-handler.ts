import type { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Nội dung yêu cầu quá lớn.' } });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ.' } });
      return;
    }
  }

  // Do not log request bodies, database URLs, session values or error stacks.
  console.error('Unhandled API error.');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra. Vui lòng thử lại.' } });
};
