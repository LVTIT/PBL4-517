import 'dotenv/config';
import { z } from 'zod';

const environmentSchemaBase = z.object({
  DATABASE_URL: z.url().refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'Use a PostgreSQL connection URL.',
  ),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PROFILE: z.enum(['production', 'lab']).default('production'),
  LAB_DATA_ACK: z.enum(['', 'synthetic-only']).default(''),
  TRUST_PROXY: z.enum(['0', 'loopback']).default('0'),
  VULN_IDOR_ENABLED: z.enum(['true', 'false']).default('false'),
  VULN_SQLI_ENABLED: z.enum(['true', 'false']).default('false'),
  VULN_XSS_ENABLED: z.enum(['true', 'false']).default('false'),
  VULN_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
});

const environmentSchema = environmentSchemaBase.superRefine((value, ctx) => {
  // Deployment purpose is independent of Node runtime/cookie security.
  // Selecting lab does not restrict network ingress: operators must do that.
  if (value.APP_PROFILE === 'lab' && value.LAB_DATA_ACK !== 'synthetic-only') {
    ctx.addIssue({ code: 'custom', path: ['LAB_DATA_ACK'], message: 'Lab requires synthetic data acknowledgment.' });
  }
  if (value.APP_PROFILE !== 'lab') {
    for (const flag of ['VULN_IDOR_ENABLED', 'VULN_SQLI_ENABLED', 'VULN_XSS_ENABLED', 'VULN_AUTH_ENABLED'] as const) {
      if (value[flag] === 'true') {
        ctx.addIssue({
          code: 'custom',
          path: [flag],
          message: 'OWASP flags require APP_PROFILE=lab and synthetic data.',
        });
      }
    }
  }
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  // Report variable names only: validation errors must not echo secrets.
  const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Invalid environment: ${names.join(', ')}. Check backend/.env.example.`);
}

export const config = parsed.data;
