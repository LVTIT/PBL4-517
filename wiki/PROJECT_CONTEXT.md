# Project context

PBL4-517 là dự án môn PBL4: tìm hiểu AWS Cloud, xây dựng chương trình phân tích và giám sát các điểm yếu bảo mật từ bên ngoài. Website thương mại điện tử là ứng dụng để triển khai, quan sát và kiểm thử; mục tiêu không chỉ là hoàn thiện giao diện bán hàng.

Nhóm: Lê Viết Thương (team leader), Nguyễn Thái Toàn và Đinh Khang Ninh. Nhóm đã sử dụng TypeScript ở PBL3; tài liệu và source cần đủ đơn giản để ba thành viên tiếp tục học React, Express và vận hành Linux.

## Các subsystem

| Thành phần | Trách nhiệm | Phạm vi hiện tại |
| --- | --- | --- |
| `website/` | React frontend, Express API, PostgreSQL/Prisma, tài khoản và sản phẩm | Source skeleton Issue #8; xem trạng thái kiểm chứng trong [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| `scanner/` | External TCP monitoring, baseline and change detection | Implemented; reliability tests local PASS; external Ubuntu VM scheduling/reboot and AWS acceptance pending. See [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| `alerts/` | Telegram/Discord notifications and ChatOps | Implemented with historical dual-alert evidence; new durable delivery tests simulated locally. See [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| AWS infrastructure | EC2 Ubuntu, VPC/subnets, SG/NACL and ALB | EC2 website/HTTPS/systemd have evidence; latest AWS availability is not rechecked. Network review and ALB remain Planned. See [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Security testing | Controlled exploit, defense and retest | IDOR historical evidence; SQLi/XSS/auth local lifecycle integration. AWS misconfiguration lab pending. See [SECURITY_PLAN.md](SECURITY_PLAN.md) |
| `evidence/` | Lưu bằng chứng kiểm thử và triển khai đã thực hiện | Không lưu secret/dữ liệu thật; wiki chỉ liên kết tới evidence cần thiết |
| `docs/`, `scripts/` | Tài liệu lịch sử/báo cáo phù hợp và script hỗ trợ có phạm vi rõ ràng | `docs/README.md` là hồ sơ quyết định stack Issue #7 |

## Mục tiêu theo giai đoạn

- Local website: Home, Login bằng session thật, Products từ PostgreSQL, migration/seed và hướng dẫn clone sạch. Đây là phạm vi [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8).
- Linux/AWS: triển khai website trên Ubuntu Server EC2, phục vụ frontend/API qua Nginx, quản lý backend bằng systemd; tiếp đó hoàn thiện kiến trúc VPC, Security Group, Network ACL và Application Load Balancer.
- Scanner và alert: quét host trong phạm vi cho phép từ mạng bên ngoài; lần đầu ghi nhận/cảnh báo port đang mở, các lần sau phát hiện port mới mở và gửi Telegram/Discord. Port mở là kết quả giám sát, chưa chứng minh một lỗ hổng ứng dụng.
- OWASP: dùng dữ liệu giả và môi trường lab tách biệt cho chu trình **vulnerable → exploit → evidence → fix → retest**. Ghi phiên bản OWASP và điều kiện thử; không tuyên bố hệ thống hết mọi lỗ hổng sau một kịch bản PASS.

Cart, checkout, payment, order workflow, admin đầy đủ và triển khai AWS không thuộc Issue #8. Không ghi các mục tiêu tương lai thành tính năng đã hoàn thành. [ARCHITECTURE.md](ARCHITECTURE.md) mô tả luồng hệ thống; [CURRENT_STATUS.md](CURRENT_STATUS.md) là nơi duy nhất tổng hợp tiến độ hiện tại.
