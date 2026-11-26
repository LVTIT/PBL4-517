# Phạm vi chuyển sang Burp và kết quả kiểm tra

Audit ngày 26/11/2026 trên nhánh `feature/burp-suite-demo`, nguồn ứng dụng tại `1444cb9`. [Issue #44](https://github.com/LVTIT/PBL4-517/issues/44) theo dõi hồi quy tổng hợp; [#68](https://github.com/LVTIT/PBL4-517/issues/68) theo dõi môi trường local. Cả hai đang mở. Các lab web #24, #37, #38, #40 đã đóng. #41 và #43 theo dõi hạ tầng và monitoring.

| Thành phần hiện có | Chức năng giữ lại | Phần chuyển đổi và file |
| --- | --- | --- |
| [Launcher](../../scripts/dev/README.md), [fixture](../../website/backend/src/scripts/lab-fixtures.ts) | PostgreSQL local, tài khoản giả, đơn, sản phẩm và review dùng lại | README Burp dẫn đến lệnh setup canonical và dùng launcher secure |
| [API và UI](../../website/README.md), bốn cờ trong [config](../../website/backend/src/lib/config.ts) | Mặc định false, kiểm tra profile và xác nhận dữ liệu lab | [labs.md](labs.md) nối mỗi request với service hoặc component chịu trách nhiệm |
| [Demo CLI](../../scripts/demo/README.md), [bộ probe](../../scripts/attacker/README.md), [security lifecycle](../../website/backend/tests/security-lifecycle.test.mjs) | Probe, trình duyệt và regression hiện có | README gốc và README demo dẫn người học đến Burp; wiki ghi tiến độ |
| [Scanner](../../scanner/README.md) | Đo TCP, so với baseline, phát hiện thay đổi và gửi cảnh báo | Dạy A05 bằng công cụ hiện có; Burp phụ trách quan sát HTTP |

## Đã chạy trong lượt này

| Kiểm tra | Kết quả | Giới hạn |
| --- | --- | --- |
| Cài Burp trên Windows | Bản Community chính thức `2026.3.3-47134`; SHA-256 bộ cài khớp manifest WinGet, đã chạy lệnh xem phiên bản | Phiên đầu dừng tại bước xác nhận điều khoản. Ảnh HTTP history của KEVILO và thao tác Repeater/Comparer trên máy này chờ xác nhận trực tiếp |
| Launcher secure và Chromium | PostgreSQL 16 healthy; GET danh mục qua Vite trả 200 và 11 sản phẩm; [ảnh local](catalogue-local.png) | Trình duyệt mới, chưa đăng nhập |
| Chromium đọc trang chi tiết có review fixture đã lưu | Một comment có dấu `<` trong text, 0 phần tử DOM con | Quan sát riêng nhánh secure |
| Backend `test:integration` | 40/40 qua, API và PostgreSQL local | Có kiểm tra session, ranh giới quyền và tìm kiếm |
| Backend `test:config` và `test:data-errors` | 2/2 và 26/26 qua | Cấu hình và ánh xạ lỗi |
| Frontend `test:e2e -- --workers=2` | 58/58 qua | Suite desktop/mobile dùng fixture riêng |
| Python unittest cho `scanner/tests` và `scripts/demo/tests` | 55/55 và 9/9 qua | Socket local và delivery mô phỏng; nhận tin thật cần chứng cứ riêng |

## CI và nghiệm thu

Ở revision tài liệu `8909fa6`, job [backend-integration](https://github.com/LVTIT/PBL4-517/actions/runs/45735757721/job/139628468713) đã chạy lại suite security lifecycle trên fixture riêng, gồm cả phép kiểm cùng review đã lưu trong Chromium ở hai chế độ. Job qua. Đọc song song [ma trận kết quả lịch sử](../../evidence/TEST-02/pr56-integration-20261026/README.md) để theo dõi từng trường hợp.

Năm trong sáu job qua. Trong [backend-build](https://github.com/LVTIT/PBL4-517/actions/runs/45735757721/job/139628468775), build và test cấu hình qua, bước audit chặn phụ thuộc gián tiếp `effect` của Prisma vì [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw). Theo dõi CI ở [PR #76](https://github.com/LVTIT/PBL4-517/pull/76/checks) cho revision mới nhất.

Khi nghiệm thu, ghi riêng kết quả thao tác GUI Burp, xác nhận nhận cảnh báo thật nếu có và nhận xét của người review. Người hướng dẫn xác nhận phần sinh viên giải thích trực tiếp.
