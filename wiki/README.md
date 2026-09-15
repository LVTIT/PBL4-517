# PBL4-517 Project Knowledge Base

`wiki/` là **Single Source of Truth cho context lâu dài** của repository: mục tiêu, kiến trúc, quyết định, quy ước và tiến độ. Hướng dẫn chạy từng subsystem nằm trong README của subsystem đó; báo cáo và bằng chứng kiểm thử không lưu ở đây.

PBL4-517 tìm hiểu Linux và AWS Cloud thông qua website thương mại điện tử, scanner bên ngoài, thông báo Telegram/Discord và kiểm thử bảo mật. Nhóm gồm Lê Viết Thương (team leader), Nguyễn Thái Toàn và Đinh Khang Ninh. Các subsystem được phân định tại [Project context](PROJECT_CONTEXT.md).

## Thứ tự đọc dành cho AI Agent

1. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [DECISIONS.md](DECISIONS.md)
4. [CURRENT_STATUS.md](CURRENT_STATUS.md)
5. Tài liệu chuyên môn liên quan task hiện tại, README subsystem, GitHub Issue và source hiện có.

| Tài liệu | Nội dung canonical |
| --- | --- |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Mục tiêu đề tài, phạm vi và các subsystem |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Kiến trúc hiện tại và mục tiêu; ranh giới kết nối |
| [DECISIONS.md](DECISIONS.md) | Decision log: Accepted / Superseded / Proposed |
| [CURRENT_STATUS.md](CURRENT_STATUS.md) | Tiến độ đã kiểm chứng, việc tiếp theo và vấn đề còn lại |
| [WEB_STACK.md](WEB_STACK.md) | Stack đã chốt và convention web |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Quy trình làm việc, kiểm tra và Git |
| [SECURITY_PLAN.md](SECURITY_PLAN.md) | Secure baseline và chiến lược OWASP lab |
| [website/README.md](../website/README.md) | Setup database/env, install, migrate, seed, run, build và test website |

## Quyết định quan trọng

- Stack [Issue #7](https://github.com/LVTIT/PBL4-517/issues/7) đã Accepted; xem [WEB_STACK.md](WEB_STACK.md). `docs/README.md` giữ hồ sơ lịch sử của quyết định, không phải nơi duy trì một stack cạnh tranh với wiki.
- [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8) tập trung Home, Login, Products, backend, PostgreSQL và chạy local từ clone sạch. Trạng thái kiểm chứng nằm ở [CURRENT_STATUS.md](CURRENT_STATUS.md).
- Website nằm trong `website/frontend` và `website/backend`, API có prefix `/api/`, session phía server lưu PostgreSQL với cookie HttpOnly và CSRF token.
- `main` giữ secure baseline; các phiên bản cố tình có lỗ hổng phải theo [SECURITY_PLAN.md](SECURITY_PLAN.md).
- Phân biệt **Implemented** (có triển khai thực tế), **Planned** (mục tiêu đã lên kế hoạch nhưng chưa triển khai) và **Proposed** (đề xuất chưa chốt). Có source chưa đồng nghĩa mọi kiểm thử đã PASS; đọc trạng thái kiểm chứng trước khi kết luận hoàn thành.

Nếu code và wiki mâu thuẫn, kiểm tra Git history và Issue để xác định nguồn mới nhất, rồi sửa tài liệu lỗi thời trong phạm vi task. Không tự suy đoán bên nào đúng hoặc âm thầm đổi một quyết định Accepted.
