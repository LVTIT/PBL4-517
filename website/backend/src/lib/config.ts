import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.url().refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'Use a PostgreSQL connection URL.',
  ),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUST_PROXY: z.enum(['0', 'loopback']).default('0'),
  VULN_IDOR_ENABLED: z.enum(['true', 'false']).default('false'),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  // Report variable names only: validation errors must not echo secrets.
  const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Invalid environment: ${names.join(', ')}. Check backend/.env.example.`);
}

export const config = parsed.data;
