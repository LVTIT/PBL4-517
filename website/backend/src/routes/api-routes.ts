import { Router } from 'express';
import { getProducts } from '../controllers/product-controller.js';
import { prisma } from '../lib/database.js';
import { databaseUnavailable } from '../lib/errors.js';
import { authRoutes } from './auth-routes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw databaseUnavailable();
  }
  res.json({ data: { status: 'ok', database: 'connected' } });
});
apiRoutes.get('/products', getProducts);
apiRoutes.use('/auth', authRoutes);
