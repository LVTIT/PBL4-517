import { Prisma } from '../generated/prisma/client.js';
import { AppError, databaseUnavailable } from './errors.js';

// A code alone does not prove a request error. In particular, a missing row
// inside an inventory transaction can mean a broken internal invariant.
type DataOperation = 'default' | 'update-product' | 'delete-product' | 'register-email-conflict';

export function translatePrismaError(error: unknown, operation: DataOperation = 'default'): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // The caller must have re-read the conflicting email after P2002.
      // Prisma 7's pg adapter does not always supply meta.target.
      if (operation === 'register-email-conflict' && error.meta?.modelName === 'User') {
        return new AppError(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
      }
      return new AppError(409, 'CONFLICT', 'Dữ liệu đã tồn tại.');
    }
    if (error.code === 'P2025' && error.meta?.modelName === 'Product' &&
        (operation === 'update-product' || operation === 'delete-product')) {
      return new AppError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.');
    }
    if (error.code === 'P2003' && error.meta?.modelName === 'Product' && operation === 'delete-product') {
      return new AppError(409, 'CONFLICT',
        'Dữ liệu đang được tham chiếu ở nơi khác nên không thể thay đổi hoặc xoá.');
    }
  }

  // Broad format/check/relation failures can indicate an internal invariant.
  // Controllers validate IDs; domain checks retain priority. Unknown,
  // infrastructure and unsafe-to-classify errors keep the 503 fallback.
  return databaseUnavailable();
}

export function rethrowDataError(error: unknown, operation: DataOperation = 'default'): never {
  throw translatePrismaError(error, operation);
}
