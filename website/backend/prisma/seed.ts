import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed is disabled in production.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const products = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Bàn phím cơ Mini 68', description: 'Bàn phím gọn với 68 phím, kết nối USB-C và switch êm cho góc học tập.', price: '790000.00', stock: 18, category: 'Bàn phím' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Chuột không dây Everyday', description: 'Chuột không dây nhẹ, thiết kế thuận tay và độ nhạy có thể điều chỉnh.', price: '290000.00', stock: 32, category: 'Chuột' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Tai nghe Studio Lite', description: 'Tai nghe chụp tai với đệm mềm và microphone cho lớp học trực tuyến.', price: '590000.00', stock: 12, category: 'Âm thanh' },
  { id: '10000000-0000-4000-8000-000000000004', name: 'Hub USB-C 5 trong 1', description: 'Mở rộng kết nối với HDMI, USB và cổng sạc USB-C trong một thiết bị nhỏ gọn.', price: '450000.00', stock: 9, category: 'Phụ kiện' },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Giá đỡ laptop nhôm', description: 'Giá đỡ có thể gấp gọn, nâng màn hình và tạo khoảng thoáng dưới laptop.', price: '350000.00', stock: 24, category: 'Phụ kiện' },
  { id: '10000000-0000-4000-8000-000000000006', name: 'Đèn bàn Focus', description: 'Đèn LED để bàn với ba mức ánh sáng và cần đèn có thể điều chỉnh.', price: '390000.00', stock: 0, category: 'Đèn bàn' },
];

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
