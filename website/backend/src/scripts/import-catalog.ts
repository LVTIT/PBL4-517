import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { DEMO_CATALOG } from '../data/catalog.js';

if (!process.env.DATABASE_URL) {
  console.error('Lỗi: DATABASE_URL chưa được cấu hình.');
  process.exit(1);
}

const isApply = process.argv.includes('--apply');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function run() {
  console.log('='.repeat(60));
  console.log(`KEVILO Catalog Importer — Chế độ: ${isApply ? 'ÁP DỤNG THẬT (--apply)' : 'DRY-RUN (Thử nghiệm)'}`);
  console.log('='.repeat(60));

  const existingProducts = await prisma.product.findMany();
  const existingMap = new Map(existingProducts.map((p) => [p.id, p]));

  let willCreate = 0;
  let willUpdate = 0;
  let unchanged = 0;

  for (const item of DEMO_CATALOG) {
    const existing = existingMap.get(item.id);
    if (!existing) {
      willCreate++;
      console.log(`[TẠO MỚI] ID: ${item.id} | ${item.name} (${item.category}) | Giá: ${item.price} | Tồn kho khởi tạo: ${item.defaultStock}`);
      if (isApply) {
        await prisma.product.create({
          data: {
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            stock: item.defaultStock,
            category: item.category,
            imageKey: item.imageKey,
          },
        });
      }
    } else {
      willUpdate++;
      console.log(`[CẬP NHẬT] ID: ${item.id} | ${item.name} | Giữ nguyên tồn kho hiện tại: ${existing.stock}`);
      if (isApply) {
        await prisma.product.update({
          where: { id: item.id },
          data: {
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            imageKey: item.imageKey,
            // Note: Does NOT overwrite existing.stock!
          },
        });
      }
    }
  }

  console.log('-'.repeat(60));
  console.log(`Tổng kết: ${willCreate} tạo mới, ${willUpdate} cập nhật thông tin (bảo toàn tồn kho).`);
  console.log(`Số lượng sản phẩm trong database hiện tại: ${existingProducts.length}`);
  if (!isApply) {
    console.log('\n[LƯU Ý] Đây là chế độ DRY-RUN, không có thay đổi nào được ghi vào cơ sở dữ liệu.');
    console.log('Để thực thi thay đổi thật, hãy chạy lại lệnh với cờ: --apply');
  } else {
    const finalCount = await prisma.product.count();
    console.log(`[THÀNH CÔNG] Đã áp dụng thành công. Tổng số sản phẩm sau khi import: ${finalCount}`);
  }
}

run()
  .catch((err) => {
    console.error('Import thất bại:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
