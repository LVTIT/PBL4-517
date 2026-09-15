import { prisma } from '../lib/database.js';
import { databaseUnavailable } from '../lib/errors.js';

export async function listProducts() {
  try {
    const products = await prisma.product.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return products.map((product) => ({ ...product, price: product.price.toFixed(2) }));
  } catch {
    throw databaseUnavailable();
  }
}
