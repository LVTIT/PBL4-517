import type { ApiResponse } from '../types/api';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return;
  const error = body.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return;
  if (typeof error.message === 'string') return error.message;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(errorMessage(body) ?? 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.', response.status);
  }
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new ApiError('Phản hồi không hợp lệ. Vui lòng thử lại sau.', response.status);
  }
  return (body as ApiResponse<T>).data;
}

export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

export async function post<T>(path: string, body: unknown = {}): Promise<T> {
  // Fetch a current token: successful login rotates the server-side session.
  const { csrfToken } = await get<{ csrfToken: string }>('/auth/csrf');
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
}

export function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
