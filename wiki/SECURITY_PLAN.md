# Security plan

## Secure baseline

**Status: Accepted** — theo yêu cầu Issue #8 và hướng dẫn knowledge base ngày 2026-09-14. `main` giữ baseline bảo mật bình thường; không cố tình tạo lỗ hổng trong skeleton.

Source web có password hashing, validation runtime/body limit, rate limit login, HTTP security headers, Prisma parameterized queries, PostgreSQL session store, HttpOnly/SameSite cookie, Secure cookie khi production, CSRF token và xử lý lỗi tập trung. Chi tiết cấu hình/hợp đồng hiện hành ở [website/README.md](../website/README.md#session-password-và-csrf), kết quả kiểm chứng ở [CURRENT_STATUS.md](CURRENT_STATUS.md). Baseline không phải lời cam kết hệ thống không có lỗ hổng.

## OWASP lab

**Status: Planned.** Chưa tạo phiên bản vulnerable, chưa khai thác và chưa có evidence của các scenario dưới đây.

```text
main → secure baseline

lab/OWASP hoặc branch lab tương đương
    → intentionally vulnerable version
    → exploit trong phạm vi được phép
    → evidence
    → fix
    → retest
```

- Tách branch và môi trường lab được kiểm soát; ghi phạm vi host, tài khoản thử và thời gian thực hành trước khi chạy. Tên branch cụ thể sẽ chốt khi tạo lab.
- Chỉ dùng dữ liệu giả; không để môi trường vulnerable public không kiểm soát. Không đưa lỗ hổng cố ý trở lại `main`.
- Chọn và ghi rõ phiên bản OWASP Top 10, điều kiện tái hiện, kết quả trước/sau fix. Không suy ra lỗ hổng ứng dụng chỉ từ một port mở.
- Evidence phải đủ để tái hiện và đánh giá fix; loại bỏ password thật, session cookie/token, database URL có mật khẩu và cloud credential. Lưu evidence vào `evidence/` theo issue, không nhét báo cáo vào wiki.
- Chỉ ghi scenario Completed khi đã có exploit, fix và retest thực tế. Có thể đưa fix phù hợp về baseline theo workflow review; không merge phần cố ý làm yếu ứng dụng.

## Kịch bản thực nghiệm OWASP Top 10

| Scenario | Trạng thái | Chi tiết triển khai & Công cụ |
| :--- | :--- | :--- |
| **A01: Broken Access Control (IDOR)** | **Completed (Verified with Evidence)** | Chu trình toàn vẹn: Đọc (`GET`), Sửa địa chỉ (`PATCH`), Hủy đơn (`POST`). Phòng thủ tầng DB (*Database-level Scoping*), cờ `VULN_IDOR_ENABLED`, UI trực quan ([`OrderDetailPage`](../website/frontend/src/pages/OrderDetailPage.tsx)), 3 script attacker và 7 file bằng chứng tại [`evidence/OWASP-01/`](../evidence/OWASP-01/). |
| **A01: Admin Authorization** | **Implemented (Baseline)** | Phân quyền nghiêm ngặt qua middleware `requireAdmin`; Admin bị chặn đặt hàng (`ADMIN_CANNOT_ORDER`) và chặn tự review sản phẩm. |
| **A03: Injection (SQLi)** | **Planned** | Ô tìm kiếm `GET /api/products?search=...` (chuẩn bị kịch bản `VULN_SQLI_ENABLED` với query ghép chuỗi thô). |
| **A03: Stored XSS** | **Planned** | Bình luận sản phẩm `POST /api/products/:id/reviews` (chuẩn bị kịch bản `VULN_XSS_ENABLED`). |
| **A05: Security Misconfiguration** | **Implemented (Verified with Dual Alerts)** | Module `scanner/` dò quét cổng mở đa luồng trên AWS Security Group, lưu baseline chênh lệch (`scanner_state.json`) và gửi cảnh báo tức thì về cả Discord Webhook và Telegram Group Bot. |
| **A07: Authentication & Brute Force** | **Implemented (Baseline)** | Đã triển khai rate limiter, bcrypt hash mật khẩu, kiểm tra phiên session phía server. |

Cơ chế thực nghiệm sử dụng cờ môi trường (`VULN_*_ENABLED=true/false`) để đảm bảo nhánh `main` luôn là **Secure Baseline** khi deploy lên AWS Cloud, đồng thời cho phép bật nhanh chế độ có lỗ hổng khi demo khai thác và kiểm chứng bịt lỗi.
