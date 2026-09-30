import { config } from '../lib/config.js';
import { prisma } from '../lib/database.js';
import { AppError, databaseUnavailable } from '../lib/errors.js';

function isSqlInjectionVulnerable(): boolean {
  return config.VULN_SQLI_ENABLED === 'true';
}

/**
 * OWASP A03 lab path only. Reached exclusively when VULN_SQLI_ENABLED=true,
 * which config.ts refuses to load under NODE_ENV=production. `search` is
 * concatenated into the statement on purpose so a lab can demonstrate the
 * injection; the Secure Baseline below never builds SQL from user input.
 */
async function listProductsWithRawSql(search: string, category?: string) {
  const trimmedSearch = search.trim();
  const trimmedCategory = category && category !== 'ALL' ? category.trim() : '';
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, name, description, price::text AS price, stock, category, "createdAt", "updatedAt"
     FROM "Product"
     WHERE (name ILIKE '%${trimmedSearch}%' OR description ILIKE '%${trimmedSearch}%')
       ${trimmedCategory ? `AND category = '${trimmedCategory}'` : ''}
     ORDER BY "createdAt" ASC, id ASC`,
  );
  return rows.map((row) => ({ ...row, price: String(row.price) }));
}

export async function listProducts(search?: string, category?: string) {
  try {
    if (isSqlInjectionVulnerable() && search && search.trim()) {
      return await listProductsWithRawSql(search, category);
    }

    const where: Record<string, unknown> = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return products.map((product) => ({ ...product, price: product.price.toFixed(2) }));
  } catch {
    throw databaseUnavailable();
  }
}

export async function getProductById(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!product) {
      throw new AppError(404, 'NOT_FOUND', 'Sản phẩm không tồn tại.');
    }
    const avgRating = product.reviews.length > 0
      ? Number((product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length).toFixed(1))
      : 5;
    return {
      ...product,
      price: product.price.toFixed(2),
      averageRating: avgRating,
      reviewCount: product.reviews.length,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
  category?: string;
}) {
  try {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price.toFixed(2),
        stock: data.stock,
        category: data.category ?? 'Phụ kiện',
      },
    });
    return { ...product, price: product.price.toFixed(2) };
  } catch {
    throw databaseUnavailable();
  }
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
  }>
) {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price.toFixed(2);
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.category !== undefined) updateData.category = data.category;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });
    return { ...product, price: product.price.toFixed(2) };
  } catch {
    throw databaseUnavailable();
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    return { success: true };
  } catch {
    throw databaseUnavailable();
  }
}

export async function addReview(productId: string, userId: string, rating: number, comment: string) {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError(404, 'NOT_FOUND', 'Sản phẩm không tồn tại.');
    }
    return await prisma.review.create({
      data: {
        productId,
        userId,
        rating,
        comment,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

export async function listReviews(productId: string) {
  try {
    return await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    throw databaseUnavailable();
  }
}
