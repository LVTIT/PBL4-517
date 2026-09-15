import type { User } from '../generated/prisma/client.js';

export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;
