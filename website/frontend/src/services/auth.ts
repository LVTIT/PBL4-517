import { createContext, useContext } from 'react';
import type { User } from '../types/api';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
