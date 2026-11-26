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
| Launcher secure và Chromium | PostgreSQL 16 healthy; GET danh mục qua Vite trả 200 và 11 sản phẩm; [ảnh local](catalogue-local.png) | Trình duyệt mới, chưa đăng nhập |
| Chromium đọc trang chi tiết có review fixture đã lưu | Một comment có dấu `<` trong text, 0 phần tử DOM con | Quan sát riêng nhánh secure |
| Backend `test:integration` | 40/40 qua, API và PostgreSQL local | Có kiểm tra session, ranh giới quyền và tìm kiếm |
| Backend `test:config` và `test:data-errors` | 2/2 và 26/26 qua | Cấu hình và ánh xạ lỗi |
| Frontend `test:e2e -- --workers=2` | 58/58 qua | Suite desktop/mobile dùng fixture riêng |
| Python unittest cho `scanner/tests` và `scripts/demo/tests` | 55/55 và 9/9 qua | Socket local và delivery mô phỏng; nhận tin thật cần chứng cứ riêng |

Đối chiếu hai chế độ của cả bốn bài dùng [kết quả hồi quy đã lưu](../../evidence/TEST-02/pr56-integration-20261026/README.md). Khi nghiệm thu, ghi riêng lượt đi qua Burp, revision, kết quả hiển thị trong browser, CI của PR và nhận xét của người review. Người hướng dẫn xác nhận phần sinh viên giải thích trực tiếp.
