# Bản đồ học code PBL4-517

Đề tài là **AWS/Linux + giám sát bên ngoài + khai thác/vá/retest**. Website KEVILO
là ứng dụng để thực hành. Bắt đầu từ [README](../README.md), rồi
[demo từng bước](../scripts/demo/README.md). Không cần đọc toàn bộ evidence trước.

## Đọc theo ba lượt

1. **Chạy được:** website README, env mẫu, demo IDOR. Hiểu frontend gọi `/api`,
   backend đọc session, Prisma truy cập PostgreSQL. Chạy lượt secure rồi kiểm tra owner.
2. **Giải thích được:** lần theo một request ở bảng dưới; đọc nhánh lab và secure,
   sau đó đọc probe đo cùng hành vi. Tự giải thích vì sao mã HTTP không đủ nếu
   dữ liệu/stock vẫn bị sửa, hoặc API lỗi không chứng minh đã vá.
3. **Vận hành được:** scanner fundamentals, state/outbox, log, runbook EC2,
   SG/NACL và thiết kế ALB. Đối chiếu source với evidence có thời điểm/revision.

## Những file nên đọc trước

| Muốn hiểu | File bắt đầu | Tiếp tục |
| --- | --- | --- |
| Lệnh dev/setup | `scripts/dev/cli.ps1` | `run.ps1`, `setup.mjs` |
| Lệnh demo ngắn | `scripts/demo/cli.py` | `scripts/demo/report.py`, `scripts/attacker/demo.py` |
| Lõi probe dùng chung | `scripts/attacker/core.py` | `Client`, `login`, `request`, `redact_evidence` |
| API khởi động | `website/backend/src/server.ts` | `app.ts`, `routes/api-routes.ts` |
| Env/cờ lab | `website/backend/src/lib/config.ts` | `.env.example`, `scripts/dev/settings.mjs` |
| Session/CSRF/login | `middleware/session.ts`, `middleware/csrf.ts` | `routes/auth-routes.ts`, `services/auth-service.ts` |
| IDOR | `website/backend/src/services/order-service.ts` | `scripts/attacker/probes/idor.py::run` |
| SQLi | `website/backend/src/services/product-service.ts` | `scripts/attacker/probes/sqli.py::run` |
| XSS | `website/frontend/src/pages/ProductDetailPage.tsx` | `product-service.ts`, `scripts/attacker/xss.mjs` |
| Authentication lab | `website/backend/src/routes/auth-routes.ts` | `scripts/attacker/probes/auth.py::run` |
| Dữ liệu | `website/backend/prisma/schema.prisma` | `migrations/`, `src/scripts/lab-fixtures.ts` |
| TCP scan/baseline | `scanner/scan.py` | `scanner/state_store.py`, `scanner/FUNDAMENTALS.md` |
| Alert/retry/bot | `alerts/notifier.py` | `alerts/bot_listener.py`, `scanner/config.py` |
| EC2 | [DEMO.md](aws/DEMO.md) | Nginx/systemd/network/HTTPS runbook được liên kết ở đó |

Các đường dẫn middleware/routes/services viết ngắn trong bảng là tương đối từ
`website/backend/src`. Test assertions ở `website/backend/tests`, frontend E2E
ở `website/frontend/tests/e2e`. Không sửa source generated Prisma hoặc dist.

## Tránh hiểu sai

- Lệnh secure chọn nhánh đã phòng vệ trong ứng dụng; script không tự tìm và vá
  mọi lỗ hổng. Một cờ cấu hình không thay thế kiểm soát mạng của môi trường lab.
- Scanner TCP không phát hiện đầy đủ SQLi/XSS/IDOR. Báo cáo port không là pentest
  toàn hệ thống hoặc chứng nhận bảo mật.
- Local PASS, CI PASS và deploy EC2 PASS là ba tầng kiểm chứng khác nhau.
- ALB hiện là thiết kế, không phải resource đã triển khai. DB cùng EC2 nội bộ
  không đồng nghĩa đang có database trong private subnet riêng.

Tiến độ hiện hành: [CURRENT_STATUS](../wiki/CURRENT_STATUS.md). Context/decisions:
[wiki](../wiki/README.md). Các báo cáo cũ vẫn giữ để tra cứu, không là lộ trình đọc.
