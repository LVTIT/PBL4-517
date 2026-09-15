import type { RequestHandler } from 'express';
import { listProducts } from '../services/product-service.js';

export const getProducts: RequestHandler = async (_req, res) => {
  res.json({ data: await listProducts() });
};
