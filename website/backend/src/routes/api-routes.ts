import { Router } from 'express';
import {
  getProducts,
  getProduct,
  handleAddReview,
  handleCreateProduct,
  handleDeleteProduct,
  handleGetReviews,
  handleUpdateProduct,
} from '../controllers/product-controller.js';
import {
  handleCancelOrder,
  handleCreateOrder,
  handleGetAllOrders,
  handleGetOrderById,
  handleGetUserOrders,
  handleUpdateOrderDetails,
  handleUpdateOrderStatus,
} from '../controllers/order-controller.js';
import { prisma } from '../lib/database.js';
import { databaseUnavailable } from '../lib/errors.js';
import { csrfProtection } from '../middleware/csrf.js';
import { sessionMiddleware } from '../middleware/session.js';
import { requireAdmin, requireAuth } from '../middleware/auth-guard.js';
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

// Auth sub-routes
apiRoutes.use('/auth', authRoutes);

// Public Product routes
apiRoutes.get('/products', getProducts);
apiRoutes.get('/products/:id', getProduct);
apiRoutes.get('/products/:id/reviews', handleGetReviews);

// Protected Product & Review routes
apiRoutes.post('/products/:id/reviews', sessionMiddleware, csrfProtection, requireAuth, handleAddReview);
apiRoutes.post('/products', sessionMiddleware, csrfProtection, requireAdmin, handleCreateProduct);
apiRoutes.put('/products/:id', sessionMiddleware, csrfProtection, requireAdmin, handleUpdateProduct);
apiRoutes.delete('/products/:id', sessionMiddleware, csrfProtection, requireAdmin, handleDeleteProduct);

// Protected Order routes
apiRoutes.get('/orders', sessionMiddleware, csrfProtection, requireAuth, handleGetUserOrders);
apiRoutes.post('/orders', sessionMiddleware, csrfProtection, handleCreateOrder);
apiRoutes.get('/orders/:id', sessionMiddleware, csrfProtection, requireAuth, handleGetOrderById);
apiRoutes.patch('/orders/:id', sessionMiddleware, csrfProtection, requireAuth, handleUpdateOrderDetails);
apiRoutes.post('/orders/:id/cancel', sessionMiddleware, csrfProtection, requireAuth, handleCancelOrder);

// Admin-specific routes
apiRoutes.get('/admin/orders', sessionMiddleware, csrfProtection, requireAdmin, handleGetAllOrders);
apiRoutes.patch('/admin/orders/:id/status', sessionMiddleware, csrfProtection, requireAdmin, handleUpdateOrderStatus);
