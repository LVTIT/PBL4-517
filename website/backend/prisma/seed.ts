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
  { id: '10000000-0000-4000-8000-000000000001', name: 'Bàn phím cơ Mini 68', description: 'Bàn phím gọn với 68 phím, kết nối USB-C và switch êm cho góc học tập.', price: '790000.00', stock: 18 },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Chuột không dây Everyday', description: 'Chuột không dây nhẹ, thiết kế thuận tay và độ nhạy có thể điều chỉnh.', price: '290000.00', stock: 32 },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Tai nghe Studio Lite', description: 'Tai nghe chụp tai với đệm mềm và microphone cho lớp học trực tuyến.', price: '590000.00', stock: 12 },
  { id: '10000000-0000-4000-8000-000000000004', name: 'Hub USB-C 5 trong 1', description: 'Mở rộng kết nối với HDMI, USB và cổng sạc USB-C trong một thiết bị nhỏ gọn.', price: '450000.00', stock: 9 },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Giá đỡ laptop nhôm', description: 'Giá đỡ có thể gấp gọn, nâng màn hình và tạo khoảng thoáng dưới laptop.', price: '350000.00', stock: 24 },
  { id: '10000000-0000-4000-8000-000000000006', name: 'Đèn bàn Focus', description: 'Đèn LED để bàn với ba mức ánh sáng và cần đèn có thể điều chỉnh.', price: '390000.00', stock: 0 },
];

try {
  const passwordHash = await hash('DemoOnly517!', 12);
  await prisma.$transaction([
    prisma.user.upsert({
      where: { email: 'demo@example.com' },
      create: { email: 'demo@example.com', name: 'Khách Demo', passwordHash },
      update: { name: 'Khách Demo', passwordHash, role: 'CUSTOMER' },
    }),
    ...products.map((product) => prisma.product.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    })),
  ]);
  console.log('Seed complete: demo@example.com and 6 development products.');
} catch {
  console.error('Seed failed. Check PostgreSQL and apply migrations first.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
