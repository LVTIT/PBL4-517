import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { get, post, put, messageFrom } from '../services/api';
import { AuthContext } from '../services/auth';
import type { AuthData, User } from '../types/api';
import { clearOrderConfirmation } from '../services/order-confirmation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const ownerId = useRef<string | null | undefined>(undefined);
  const acceptUser = useCallback((next: User | null) => {
    const nextId = next?.id ?? null;
    if (ownerId.current !== undefined && ownerId.current !== nextId) clearOrderConfirmation();
    ownerId.current = nextId;
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await get<AuthData>('/auth/me');
      if (version === requestVersion.current) {
        acceptUser(data.user);
        setError(null);
      }
    } catch (error) {
      if (version === requestVersion.current) setError(messageFrom(error));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [acceptUser]);

  useEffect(() => {
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  async function login(email: string, password: string) {
    const data = await post<AuthData>('/auth/login', { email, password });
    requestVersion.current += 1;
    clearOrderConfirmation();
    acceptUser(data.user);
    setError(null);
    setLoading(false);
  }

  async function register(name: string, email: string, password: string) {
    const data = await post<AuthData>('/auth/register', { name, email, password });
    requestVersion.current += 1;
    clearOrderConfirmation();
    acceptUser(data.user);
    setError(null);
    setLoading(false);
  }

  async function logout() {
    await post<AuthData>('/auth/logout');
    requestVersion.current += 1;
    clearOrderConfirmation();
    acceptUser(null);
    setError(null);
    setLoading(false);
  }

  async function updateProfile(name: string) {
    const data = await put<AuthData>('/auth/profile', { name });
    requestVersion.current += 1;
    setUser(data.user);
    setError(null);
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    await put<{ success: boolean }>('/auth/password', { oldPassword, newPassword });
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
