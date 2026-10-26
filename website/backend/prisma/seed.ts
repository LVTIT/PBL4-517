import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

import { DEMO_CATALOG } from '../src/data/catalog.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed is disabled in production.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const products = DEMO_CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  stock: p.defaultStock,
  category: p.category,
  imageKey: p.imageKey,
}));

try {
  const customerPasswordHash = await hash('DemoOnly517!', 12);
  const adminPasswordHash = await hash('AdminOnly517!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    create: { email: 'demo@example.com', name: 'Khách Demo', passwordHash: customerPasswordHash, role: 'CUSTOMER' },
    update: { name: 'Khách Demo', passwordHash: customerPasswordHash, role: 'CUSTOMER' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    create: { email: 'admin@example.com', name: 'Quản Trị Viên', passwordHash: adminPasswordHash, role: 'ADMIN' },
    update: { name: 'Quản Trị Viên', passwordHash: adminPasswordHash, role: 'ADMIN' },
  });
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    });
  }
  // Add a sample review
  const firstProduct = products[0];
  const existingReview = await prisma.review.findFirst({
    where: { productId: firstProduct.id, userId: demoUser.id },
  });
  if (!existingReview) {
    await prisma.review.create({
      data: {
        productId: firstProduct.id,
        userId: demoUser.id,
        rating: 5,
        comment: 'Bàn phím gõ rất êm, layout nhỏ gọn phù hợp bàn học.',
      },
    });
  }
  console.log('Seed complete: demo@example.com, admin@example.com, 6 products with categories, and reviews.');
} catch (err) {
  console.error('Seed failed. Check PostgreSQL and apply migrations first.', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
