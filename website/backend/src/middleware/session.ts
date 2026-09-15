import session, { type CookieOptions } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Request, RequestHandler } from 'express';
import { config } from '../lib/config.js';
import { sessionPool } from '../lib/database.js';
import { databaseUnavailable } from '../lib/errors.js';

export const cookieName = 'pbl517.sid';
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.NODE_ENV === 'production',
  path: '/api',
} satisfies CookieOptions;

const PgSession = connectPgSimple(session);
export const sessionStore = new PgSession({
  pool: sessionPool,
  tableName: 'session',
  createTableIfMissing: false,
  pruneSessionInterval: 60 * 15,
  errorLog: () => console.error('Session store operation failed.'),
});

const middleware = session({
  name: cookieName,
  store: sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 },
});

export const sessionMiddleware: RequestHandler = (req, res, next) => {
  middleware(req, res, (error?: unknown) => next(error ? databaseUnavailable() : undefined));
};

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error: unknown) => error ? reject(databaseUnavailable()) : resolve());
  });
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => error ? reject(databaseUnavailable()) : resolve());
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => error ? reject(databaseUnavailable()) : resolve());
  });
}
