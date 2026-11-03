import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { rethrowDataError, translatePrismaError } from '../lib/data-errors.js';
import { AppError } from '../lib/errors.js';
import type { PublicUser } from '../types/auth.js';

const publicFields = { id: true, email: true, name: true, role: true } as const;
// Do comparable password work for unknown accounts to reduce account enumeration.
const dummyHash = hash(randomBytes(32).toString('hex'), 12);

export async function authenticate(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email } }).catch(rethrowDataError);
  const matches = await compare(password, user?.passwordHash ?? await dummyHash);
  if (!user || !matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function findCurrentUser(id: string): Promise<PublicUser | null> {
  return await prisma.user.findUnique({ where: { id }, select: publicFields }).catch(rethrowDataError);
}

export async function registerUser(name: string, email: string, password: string): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email } }).catch(rethrowDataError);
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
  }
  const passwordHash = await hash(password, 12);
  try {
    return await prisma.user.create({
      data: { name, email, passwordHash, role: 'CUSTOMER' },
      select: publicFields,
    });
  } catch (error) {
    // Prisma 7 pg may omit meta.target. Prove the email conflict with a fresh
    // lookup after the failed insert, rather than guessing from driver text or
    // turning every unique/foreign-key failure into EMAIL_EXISTS.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' &&
        error.meta?.modelName === 'User' &&
        await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(rethrowDataError)) {
      throw translatePrismaError(error, 'register-email-conflict');
    }
    rethrowDataError(error);
  }
}

export async function updateProfile(userId: string, name: string): Promise<PublicUser> {
  return await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: publicFields,
  }).catch(rethrowDataError);
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(rethrowDataError);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'Người dùng không tồn tại.');
  }
  const matches = await compare(oldPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không đúng.');
  }
  const newHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  }).catch(rethrowDataError);
}
