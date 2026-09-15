import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { config } from './config.js';

export const sessionPool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
});
sessionPool.on('error', () => console.error('Session database connection failed.'));

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
  }),
});

export async function closeDatabase(): Promise<void> {
  await Promise.all([prisma.$disconnect(), sessionPool.end()]);
}
