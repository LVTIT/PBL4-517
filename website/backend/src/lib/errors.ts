export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function databaseUnavailable(): AppError {
  return new AppError(503, 'DATABASE_UNAVAILABLE', 'Dịch vụ dữ liệu tạm thời không khả dụng. Vui lòng thử lại.');
}
