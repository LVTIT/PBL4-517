# Bug #65 — Admin đổi trạng thái đơn hàng làm sai tồn kho

Refs #65. Related to #44, #61.

**Historical verification on old base `43bebb1` (2026-11-01).**

The counts and combined control below belong to the old base, not final PR #66
verification. See the [2026-11-03 integration audit](audit-20261103/README.md) for
latest-main results, independent negative controls, true concurrency and review
gates. No merge or deployment is performed by the agent.

Đo trên `main` tại `43bebb1`, sửa trên `feature/65-admin-status-inventory`.

## Tóm tắt

`PATCH /api/admin/orders/:id/status` là một `prisma.order.update` duy nhất: không đọc
trạng thái hiện tại, không kiểm tra transition, không chạm bảng `Product`.

| # | Lỗi | Trước | Sau |
| --- | --- | --- | --- |
| 1 | Admin hủy đơn không hoàn kho | hàng biến mất vĩnh viễn | hoàn đúng số lượng, một lần |
| 2 | Đơn `CANCELLED` mở lại được | `200`, tạo vòng lặp hoàn kho | `409 INVALID_STATUS_TRANSITION` |
| 3 | Vòng lặp sinh tồn kho ảo | `+2` mỗi vòng, không giới hạn | `0` |

## Môi trường

Windows, Node 24.19.0, PostgreSQL 16 container dùng-một-lần
(`pbl517-adminstatus-20261101`, loopback `127.0.0.1:55445`, database `pbl517_lab_test`),
compiled backend `node dist/server.js` port `3062`, Secure Baseline (mọi `VULN_*` = `false`),
dữ liệu seed development. Container và tiến trình đã dừng/xoá sau khi đo.

Script tái hiện: `reproduce.mjs`, `reproduce-b.mjs`, `reproduce-c.mjs`.
Chạy: `$env:TEST_API_URL='http://127.0.0.1:3062'; node reproduce-b.mjs`.

## Lỗi 1 — admin hủy đơn làm mất hàng

Sản phẩm tồn `18`, khách đặt 2, admin chuyển `PENDING → CANCELLED`:

```text
TRƯỚC  stockBefore=18  stockAfterOrder=16
       admin cancel HTTP 200
       stock after cancel: 16      (đúng phải là 18)
       >>> mất 2 đơn vị hàng

SAU    admin cancel HTTP 200
       stock after cancel: 18
       leakedUnits: 0
```

So sánh: khách tự hủy đơn cùng trạng thái thì tồn kho trở lại `18` đúng. Nguyên nhân
không nằm ở `cancelOrder` mà ở chỗ có **hai** API cùng đưa một đơn về `CANCELLED` với
hai hệ quả dữ liệu khác nhau.

## Lỗi 2 — `CANCELLED` mở lại được

```text
TRƯỚC  admin PENDING -> CONFIRMED : 200
       admin CONFIRMED -> CANCELLED: 200
       admin CANCELLED -> PENDING  : 200     (không nên cho phép)
       admin CANCELLED -> CANCELLED: 200     (không nên cho phép)

SAU    admin CANCELLED -> PENDING   : 409 INVALID_STATUS_TRANSITION
       admin CANCELLED -> CONFIRMED : 409 INVALID_STATUS_TRANSITION
       admin CANCELLED -> SHIPPED   : 409 INVALID_STATUS_TRANSITION
       admin CANCELLED -> DELIVERED : 409 INVALID_STATUS_TRANSITION
       admin CANCELLED -> CANCELLED : 409 INVALID_STATUS_TRANSITION
```

## Lỗi 3 — tồn kho ảo tăng vô hạn

Cùng một đơn, lặp: khách hủy (hoàn kho) → admin mở lại `PENDING` → khách hủy tiếp.

```text
TRƯỚC  stockBefore=15  stockAfterOrder=13
       round 1: cancel 200 -> 15, admin reopen 200 -> 15
       round 2: cancel 200 -> 17, admin reopen 200 -> 17
       round 3: cancel 200 -> 19, admin reopen 200 -> 19
       stock cuối: 19   (chỉ còn 15 đơn vị có thật)
       >>> phantomUnits: +4

SAU    round 1: cancel 200 -> 19, admin reopen 409 -> 19
       round 2: cancel 400 -> 19, admin reopen 409 -> 19
       round 3: cancel 400 -> 19, admin reopen 409 -> 19
       stock cuối: 19
       >>> phantomUnits: 0
```

Đây là hệ quả nghiêm trọng nhất: #61 đã làm `cancelOrder` an toàn trong transaction,
nhưng một API khác vẫn đưa được đơn `CANCELLED` trở lại `PENDING` một cách hợp lệ, nên
lớp chặn `PENDING → CANCELLED` bị vô hiệu hoá mà không cần phá gì.

## Nguyên nhân

`website/backend/src/services/order-service.ts`:

```ts
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.update({ where: { id: orderId }, data: { status } });
  return { ...order, totalPrice: order.totalPrice.toFixed(2) };
}
```

`createOrder` trừ kho **ngay khi tạo đơn**; `cancelOrder` hoàn kho.
`updateOrderStatus` là đường hủy thứ hai nhưng không hoàn kho và không kiểm tra gì.

## Cách sửa

1. Bảng transition tường minh; `CANCELLED` là trạng thái cuối:

   | Từ | Được phép sang |
   | --- | --- |
   | `PENDING` | `CONFIRMED`, `CANCELLED` |
   | `CONFIRMED` | `SHIPPED`, `CANCELLED` |
   | `SHIPPED` | `DELIVERED` |
   | `DELIVERED` | — |
   | `CANCELLED` | — |

2. Chuyển sang `CANCELLED` thì **hoàn kho trong cùng transaction**, theo đúng thứ tự
   **claim trước, hoàn kho sau** như #61:

   ```ts
   const claim = await tx.order.updateMany({
     where: { id: orderId, status: current.status },
     data: { status },
   });
   if (claim.count === 0) throw new AppError(409, 'INVALID_STATUS_TRANSITION', ...);
   if (status === 'CANCELLED') { /* increment stock */ }
   ```

   `updateMany` có điều kiện trạng thái nguồn nên hai admin bấm cùng lúc chỉ một người
   giành được; người còn lại nhận `409` và không chạm tồn kho.

3. Gộp các dòng trùng `productId` trước khi hoàn kho.

4. Frontend `AdminPage` chỉ hiển thị transition hợp lệ và vô hiệu hoá select khi đơn đã
   ở trạng thái cuối, nên người vận hành không chọn được thao tác mà API sẽ từ chối.

## Kiểm chứng

| Kiểm tra | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| Subtest `admin status changes keep inventory honest` | **FAIL** (17/19) | **PASS** (19/19) |
| `npm run test:integration` | — | 19/19 PASS (`api-integration.txt`) |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | — | 9/9 PASS |
| `npm run build` backend | — | PASS |
| `npm run build` frontend | — | PASS |
| `python scripts/ci/repo_policy.py` | — | 411 entries, 0 violation |

Test hồi quy đã được xác minh là **thực sự bắt được lỗi**: hoàn nguyên
`order-service.ts` về `main`, build lại, chạy lại → subtest đỏ (`17 pass / 2 fail`).
Khôi phục bản vá → xanh.

Subtest kiểm tra năm điều:

- admin hủy đơn thì tồn kho trở lại đúng mức ban đầu;
- `CANCELLED` không mở lại được sang bất kỳ trạng thái nào (`409`);
- hủy lặp lại không hoàn kho lần hai;
- vòng lặp khách hủy → admin mở lại → khách hủy bị đóng, tồn kho không đổi;
- `CONFIRMED` không quay lại `PENDING`, và xác nhận đơn không làm đổi tồn kho.

## Không thay đổi

- Không đổi schema, không migration.
- Không đổi `cancelOrder` hay `createOrder` của #61 — chỉ thêm transition guard và
  hoàn kho cho đường admin.
- Không đổi luồng đọc đơn hàng, RBAC, lab OWASP.
- Không đổi `error-handler.ts`, không đổi `.env`, không tạo resource AWS, không deploy.

## Ghi chú cho reviewer

- Đọc `ALLOWED_TRANSITIONS` trước; đó là toàn bộ chính sách.
- `restockByProduct` gộp dòng trùng. Một đơn có hai dòng cùng sản phẩm chỉ được cộng
  một lần với tổng số lượng.
- Đây là lỗi Secure Baseline, không phải lỗ hổng lab có chủ đích. Lỗi 1 cần quyền admin
  nên người dùng thường không tự gây được, nhưng lỗi 2 khiến mọi lớp bảo vệ tồn kho của
  #61 bị vô hiệu hoá qua một API khác.
