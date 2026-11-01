import { Prisma } from '../generated/prisma/client.js';
import { AppError, databaseUnavailable } from './errors.js';

/**
 * Translate Prisma failures into the status code the caller actually deserves.
 *
 * Services used to end with `catch { throw databaseUnavailable(); }`, which turned
 * every Prisma error into 503. A malformed UUID or a missing record then told the
 * client "the service is temporarily unavailable", so it retried a request that can
 * never succeed. Only genuine infrastructure failures are 503; anything the request
 * payload or existing data can explain is a 4xx.
 *
 * Never include driver text, constraint internals or stack traces in the message:
 * the response goes to the client.
 */
export function translatePrismaError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Malformed value in a where/data field, e.g. a non-UUID id.
      case 'P2007':
      case 'P2023':
        return new AppError(400, 'INVALID_ID', 'Mã không hợp lệ.');
      // The record the statement depends on does not exist.
      case 'P2001':
      case 'P2015':
      case 'P2018':
      case 'P2025':
        return new AppError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.');
      // Delete/update blocked by a referencing row.
      case 'P2003':
        return new AppError(
          409,
          'CONFLICT',
          'Dữ liệu đang được tham chiếu ở nơi khác nên không thể thay đổi hoặc xoá.',
        );
      // Unique constraint. Registration maps this to a specific code because the
      // pre-check can be raced between the lookup and the insert.
      case 'P2002':
        return new AppError(409, 'CONFLICT', 'Dữ liệu đã tồn tại.');
      // Value rejected by a database CHECK or length constraint.
      case 'P2000':
      case 'P2004':
        return new AppError(400, 'INVALID_INPUT', 'Dữ liệu không hợp lệ.');
      default:
        break;
    }
  }

  return databaseUnavailable();
}

/** Convenience wrapper for `catch (error) { throw ... }` blocks in services. */
export function rethrowDataError(error: unknown): never {
  throw translatePrismaError(error);
}
