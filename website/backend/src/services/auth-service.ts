import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/database.js';
import { AppError, databaseUnavailable } from '../lib/errors.js';
import type { PublicUser } from '../types/auth.js';

const publicFields = { id: true, email: true, name: true, role: true } as const;
// Do comparable password work for unknown accounts to reduce account enumeration.
const dummyHash = hash(randomBytes(32).toString('hex'), 12);

export async function authenticate(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email } }).catch(() => {
    throw databaseUnavailable();
  });
  const matches = await compare(password, user?.passwordHash ?? await dummyHash);
  if (!user || !matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function findCurrentUser(id: string): Promise<PublicUser | null> {
  try {
    return await prisma.user.findUnique({ where: { id }, select: publicFields });
  } catch {
    throw databaseUnavailable();
  }
}
