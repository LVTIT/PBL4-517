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

## Kịch bản tiềm năng

**Status: Proposed** — danh sách ứng viên, chưa phải các bài lab đã chọn hay đã triển khai.

| Scenario | Hướng kiểm tra tương lai |
| --- | --- |
| Authentication | Validation, thông báo lỗi, chống thử password và xử lý phiên |
| Broken Access Control / IDOR | Truy cập dữ liệu của tài khoản khác khi có tài nguyên/order phù hợp |
| Admin authorization | Kiểm tra quyền phía server khi có route admin |
| XSS | Nội dung không tin cậy, cách render và security headers |
| Injection | Truy vấn database, input và ranh giới parameterization |
| Security Misconfiguration | Môi trường, lỗi, secret, port và proxy configuration |
| Session security | Fixation, expiry, logout/replay, cookie attributes và CSRF |

Order/admin chưa nằm trong skeleton Issue #8; scenario phụ thuộc các chức năng đó phải chờ task phát triển phù hợp. Khi chốt lab, thêm decision hoặc kế hoạch issue cụ thể; tham khảo [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) cho baseline CSRF hiện có.
