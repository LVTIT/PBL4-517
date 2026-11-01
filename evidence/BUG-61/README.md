# Bug #61 — Tồn kho bị kiểm tra ngoài transaction

Refs #61. Related to #44.

**Trạng thái: đã sửa trong source; chưa merge, chưa triển khai.**

Đo trên `main` tại `43bebb1` rồi sửa trên `feature/61-inventory-race`. Đây là lỗi
ở **Secure Baseline** — không phải lỗ hổng lab có chủ đích — nên nó ảnh hưởng cả
bản triển khai thật.

## Tóm tắt

| # | Lỗi | Trước | Sau |
| --- | --- | --- | --- |
| 1 | Bán vượt tồn kho trả sai mã | `503 DATABASE_UNAVAILABLE` | `400 OUT_OF_STOCK` |
| 2 | Hủy đơn hai lần làm tồn kho tăng ảo | +2 đơn vị hàng không tồn tại | 0, hoàn kho đúng một lần |

## Môi trường

Windows, Node 24.19.0, PostgreSQL 16 trong container dùng-một-lần
(`pbl517-race-20261101`, loopback `127.0.0.1:55441`, database `pbl517_lab_test`),
compiled backend `node dist/server.js`, Secure Baseline (mọi `VULN_*` = `false`),
dữ liệu seed development. Container và mọi tiến trình đã được xoá/dừng sau khi đo.

## Lỗi 1 — bán vượt tồn kho trả 503

Kịch bản: `stock = 3`, bắn **5 request đồng thời**, mỗi request mua 1.

```text
BEFORE  HTTP: [201, 201, 201, 503, 503]
        errors: ['DATABASE_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'OK', 'OK', 'OK']
        orders_created: 3   stock_after: 0

AFTER   HTTP: [201, 201, 201, 400, 400]
        errors: ['OK', 'OK', 'OK', 'OUT_OF_STOCK', 'OUT_OF_STOCK']
        orders_created: 3   stock_after: 0
```

Kịch bản nhỏ, `stock = 1`, 2 request đồng thời, tái hiện **3/3 lần**:

```text
round 1: HTTP=[201, 503] errors=['DATABASE_UNAVAILABLE'] orders_created=1 stock_after=0
round 2: HTTP=[201, 503] errors=['DATABASE_UNAVAILABLE'] orders_created=1 stock_after=0
round 3: HTTP=[201, 503] errors=['DATABASE_UNAVAILABLE'] orders_created=1 stock_after=0
```

### Nguyên nhân

`website/backend/src/services/order-service.ts`, `createOrder`:

```ts
// kiểm tra NGOÀI transaction
if (product.stock < item.quantity) { throw new AppError(400, 'OUT_OF_STOCK', ...); }

return await prisma.$transaction(async (tx) => {
  // trừ kho TRONG transaction, không điều kiện
  await tx.product.update({ data: { stock: { decrement: item.quantity } } });
```

Hai request cùng đọc giá trị `stock` trước khi bán, cùng thấy đủ hàng, rồi cùng trừ.
Ràng buộc `CHECK ("stock" >= 0)` chặn được số âm — nên dữ liệu **không** hỏng — nhưng
request thua bị ném lỗi database và bị bọc thành `DATABASE_UNAVAILABLE`.

Sai mã lỗi này không phải chuyện nhỏ: người dùng thấy "dịch vụ không khả dụng" trong khi
thực tế chỉ là hết hàng, còn người vận hành đi kiểm tra database/backend thay vì nhìn
tồn kho.

## Lỗi 2 — hủy hai lần làm tồn kho tăng ảo

Kịch bản: `stock = 10`, tạo đơn mua 2 (còn 8), rồi gửi **2 request hủy đồng thời**.

```text
BEFORE  create order: 201, stock after order: 8   (đúng)
        double-cancel HTTP: [200, 200]
        double-cancel errors: ['OK', 'OK']
        stock after double cancel: 12             (đúng phải là 10)
        >>> tồn kho tăng ảo: 2 đơn vị

AFTER   create order: 201, stock after order: 8
        double-cancel HTTP: [200, 400]
        double-cancel errors: ['OK', 'CANNOT_CANCEL']
        stock after double cancel: 10
        >>> tồn kho tăng ảo: 0
```

Lỗi này **nặng hơn** lỗi 1 vì nó tạo ra dữ liệu sai vĩnh viễn: 2 đơn vị hàng không có
thật trở thành hàng bán được.

### Nguyên nhân

`cancelOrder`:

```ts
// đọc trạng thái NGOÀI transaction
if (orderToCancel.status !== 'PENDING') { throw new AppError(400, 'CANNOT_CANCEL', ...); }

const cancelled = await prisma.$transaction(async (tx) => {
  // hoàn kho TRƯỚC
  await tx.product.update({ data: { stock: { increment: item.quantity } } });
  // đổi trạng thái SAU, không điều kiện
  return tx.order.update({ data: { status: 'CANCELLED' } });
```

Hai request cùng thấy `PENDING`, cùng hoàn kho.

## Cách sửa

Hai nguyên tắc, áp dụng cho cả hai luồng:

1. **Điều kiện phải nằm trong chính câu lệnh ghi**, không phải ở câu đọc phía trước.
2. **Giành quyền chuyển trạng thái trước, thay đổi dữ liệu sau.**

### `createOrder`

```ts
const claimed = await tx.product.updateMany({
  where: { id: productId, stock: { gte: quantity } },
  data: { stock: { decrement: quantity } },
});
if (claimed.count === 0) {
  // đọc lại để báo đúng số còn lại
  throw new AppError(400, 'OUT_OF_STOCK', ...);
}
```

`updateMany` với `stock: { gte: quantity }` là một câu SQL duy nhất. PostgreSQL bảo đảm
tính nguyên tử ở mức dòng, nên hai giao dịch đồng thời không thể cùng giành một đơn vị hàng.
`count === 0` nghĩa là đã thua cuộc đua → trả `400`, không bao giờ để ràng buộc database
biến thành `503`.

Đồng thời gộp các dòng trùng `productId` trước khi kiểm tra. Nếu client gửi 2 dòng cùng
sản phẩm, kiểm tra theo từng dòng sẽ cho qua trong khi tổng vượt tồn kho.

### `cancelOrder`

```ts
const claim = await tx.order.updateMany({
  where: { id: orderId, status: 'PENDING', ...(scoping) },
  data: { status: 'CANCELLED' },
});
if (claim.count === 0) {
  throw new AppError(400, 'CANNOT_CANCEL', ...);
}
// chỉ hoàn kho SAU khi đã giành được quyền chuyển trạng thái
for (const item of orderToCancel.items) { await tx.product.update({ data: { stock: { increment: item.quantity } } }); }
```

Chỉ một request đổi được `PENDING → CANCELLED`. Request còn lại nhận `count === 0` và
không chạm vào tồn kho.

Điều kiện `userId` được đưa vào câu `updateMany` khi ở Secure Baseline, nên việc kiểm tra
quyền sở hữu cũng nằm trong transaction thay vì chỉ dựa vào lần đọc phía trước.

## Kiểm chứng bản vá

| Kiểm tra | Kết quả |
| --- | --- |
| Test hồi quy trên code **cũ** (bản vá được stash) | **FAIL** — `concurrent stock claim` đỏ, 17/19 pass |
| Test hồi quy trên code **mới** | **PASS** — 19/19 |
| `npm run test:integration` | 19/19 PASS (`api-integration.txt`) |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | 9/9 PASS (`security-lifecycle.txt`) |
| `npm run build` | PASS |

Test hồi quy nằm trong `website/backend/tests/api.integration.test.mjs`, subtest
`concurrent stock claim: no oversell and no phantom stock`. Nó kiểm tra cả bốn điều:

- đúng số đơn được tạo bằng số hàng có thật;
- request thua trả `400 OUT_OF_STOCK`, không phải `503`;
- tồn kho không âm;
- hủy hai lần chỉ hoàn kho một lần.

## Không thay đổi

- Không đổi schema, không tạo migration. Ràng buộc `CHECK ("stock" >= 0)` giữ nguyên làm
  lớp bảo vệ cuối.
- Không đổi `updateOrderStatus` (admin) hay luồng đọc đơn hàng.
- Không đổi các lab OWASP, `config.ts`, hay `.env`.
- Không tạo resource AWS, không deploy.

## Ghi chú

Chưa thấy cách khai thác để vượt ràng buộc `CHECK`, nên đây không phải lỗ hổng leo thang
đặc quyền. Nhưng ở điều kiện tải thật (hai người cùng mua món cuối, hoặc người dùng bấm
hủy hai lần do mạng chậm), hệ thống trả sai mã lỗi và có thể tạo hàng ảo. Cả hai đều là
lỗi dữ liệu cần sửa trước khi demo.
