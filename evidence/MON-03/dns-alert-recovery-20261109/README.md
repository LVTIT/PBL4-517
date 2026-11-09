# Thử gửi lại cảnh báo trong thời gian DNS lỗi — Refs #43

## Phạm vi và môi trường

- Ngày kiểm chứng: 2026-11-09.
- Base `main`: `6c1167b0dea0d5249d2a175f496c90dbfba9538d`.
- Nhánh: `feature/43-retry-alerts-on-dns-failure`.
- Windows PowerShell, Python 3.13.13. Kiểm chứng local trên working tree trước
  commit bàn giao; exact head và kết quả hosted CI được ghi trên PR.

## Lỗi và thay đổi code

`main()` resolve target trước khi gọi `run_single_scan()`. Trước sửa,
`socket.gaierror` chỉ ghi audit rồi trả 2, nên không đi đến `_deliver_due_alerts()`.
Ngay cả khi Telegram/Discord đã phục hồi, những cảnh báo của lần quét trước vẫn
không được thử gửi lại cho đến khi DNS của target phục hồi.

`scanner/scan.py` bổ sung `handle_dns_failure()`:

1. Lấy cùng state lock với một lần quét bình thường và validate state hiện có.
2. Chỉ đọc outbox của target đang DNS lỗi; không tạo host record mới.
3. Gọi delivery helper hiện có với giới hạn hai sự kiện đến hạn. Giữ nguyên
   exponential backoff, định danh/thời điểm phát hiện và kết quả riêng từng kênh.
4. Ghi audit `DNS_FAILED`, exit 2, `retried_alerts` và `pending_alerts`.
5. Giữ nguyên baseline, uncertainty và thời điểm quan sát; `--no-alert` không gửi.
   Lỗi lock/state/audit hiển thị trên stderr và vẫn trả 2.

## Kiểm chứng trước / sau

Tám test methods mới trong `scanner/tests/test_dns_alert_recovery.py` chạy parser,
luồng DNS failure/watch, state validation/lock, persistence và audit thật. DNS,
TCP probe, report renderer và alert sender được mock; clock được điều khiển ở các
test backoff. State nằm trong thư mục tạm và được dọn sau test.

| Kịch bản | Trên code cũ | Sau sửa |
| --- | --- | --- |
| Cảnh báo đến hạn được gửi dù target DNS lỗi; các quan sát giữ nguyên | FAIL: sender không được gọi | PASS |
| Discord thành công, Telegram lỗi; đọc lại state ở t=109 không retry, t=110 chỉ gửi Telegram | FAIL: không lưu tiến độ gửi | PASS |
| Transport ném exception, lưu attempts/backoff để thử lại sau | FAIL: sender không được gọi | PASS |
| Bỏ qua sự kiện chưa đến hạn, chỉ thử hai sự kiện đến hạn mỗi lượt | FAIL: không thử sự kiện nào | PASS |
| Watch gửi cảnh báo trong lần DNS lỗi, trước khi probe được chạy sau phục hồi | FAIL: tới probe vẫn chưa gửi | PASS |
| `--no-alert` giữ state byte-for-byte và không gọi sender | PASS | PASS |
| Target chưa có record không tạo baseline và không retry cảnh báo host khác | PASS | PASS |
| State hỏng hoặc writer khác đang giữ lock: không gửi/ghi đè state | PASS | PASS |

Trước sửa: **8 tests, 5 failures**, ba controls bảo toàn dữ liệu PASS. Các failure
là assertion về việc không gửi/không lưu retry, không có lỗi setup/import.
Sau sửa: toàn bộ scanner/ChatOps **35/35 PASS**, gồm 27 test methods có sẵn và
8 test methods mới.

| Kiểm tra bổ sung | Kết quả local |
| --- | --- |
| Repository policy regression | 5/5 PASS |
| Demo result classification offline | 8/8 PASS |
| Python compileall | PASS |
| Repository policy trên Git index | 530 entries, 0 vi phạm |
| Whitespace diff | PASS |

Lệnh từ repository root:

```powershell
python -m unittest discover -s scanner/tests -p test_dns_alert_recovery.py -v
python -m unittest discover -s scanner/tests -v
python -m unittest discover -s scripts/ci/tests -v
python -m unittest discover -s scripts/attacker/tests -v
python -m compileall -q scanner alerts scripts/attacker scripts/ci
python scripts/ci/repo_policy.py
git diff --cached --check
```

Job `python-check` hiện có tự discover regression mới. Các required hosted checks
và exact tested revision được cập nhật trên PR sau khi run hoàn tất.

## Giới hạn và vận hành

Mỗi lần DNS lỗi vẫn là scan thất bại (exit 2), kể cả outbox đã hết. Không tạo
`SCAN_RECOVERED` từ kết quả gửi cảnh báo, không suy ra trạng thái cổng từ DNS lỗi.
Delivery vẫn là at-least-once: crash sau khi phía nhận chấp nhận nhưng trước khi
ghi acknowledgement có thể dẫn tới gửi trùng. Khi không lấy được lock hoặc state
hỏng, không retry; khi audit không ghi được, lỗi được hiển thị trên stderr.

Các kết quả ở đây dùng transport giả lập và loopback tests có sẵn. Tiêu chí
Ubuntu VM scheduler/reboot, receipt Telegram/Discord thật và human acceptance của
#43 tiếp tục cần kiểm chứng riêng. Hosted CI/human review được theo dõi trên PR;
Issue vẫn OPEN và Team Leader / Repository Owner thực hiện final merge.
