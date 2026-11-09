# Kiểm chứng báo lỗi gửi cảnh báo — Refs #43

Ngày: **2026-11-09**. Môi trường: Windows PowerShell, Python **3.13.13**.
Base: `main` **6c1167b**. Source được kiểm tra là thay đổi notifier/test đi kèm
commit chứa tài liệu này; SHA bàn giao và hosted CI được ghi trên PR.

## Lỗi và kết quả sửa

`alerts/notifier.py` trước sửa luôn trả `0` sau khi thử gửi, kể cả cả hai kênh
đều thất bại. Kênh chưa cấu hình vẫn bị in là `THẤT BẠI`. Hai sender nội suy
nguyên thông điệp exception vào stderr, nên exception chứa URL hoặc nội dung
request có thể đưa token/webhook vào log và chèn thêm dòng log.

Sau sửa:

| Trường hợp | Kết quả |
| --- | --- |
| Tất cả kênh đã cấu hình gửi được | Exit `0` |
| Một hoặc cả hai kênh đã cấu hình gửi lỗi | Exit `1` |
| Không có cấu hình kênh hoàn chỉnh, kể cả Telegram thiếu token/chat | Exit `2`, không gọi delivery |
| Chỉ cấu hình một kênh và gửi thành công | Exit `0`, kênh còn lại `BỎ QUA` |
| HTTP error có URL/credential trong reason | Chỉ ghi tên kênh + `HTTP 503` |
| Network/unexpected error có thông tin riêng trong message | Chỉ ghi tên kênh + loại exception, một dòng |
| Discord thành công, Telegram lỗi rồi phục hồi sau reload state | Chỉ gửi lại Telegram; payload/Event ID giữ nguyên; outbox được xóa khi gửi được |

## Before / after

Thêm `scanner/tests/test_alert_delivery.py` trước khi sửa production code rồi chạy:

```powershell
python -m unittest discover -s scanner/tests -p test_alert_delivery.py -v
```

Trên notifier gốc từ base: **6 test methods, 17 failed subtests/assertions**;
test hai kênh thành công vẫn PASS. Các failure bao gồm `0 != 1`, `1 != 2`,
kênh tắt bị ghi thất bại và log chứa các marker synthetic. Test outbox đi qua
delivery/reload/retry thành công rồi FAIL ở assertion phát hiện token giả trong
log. Đây là kiểm chứng lỗi báo cáo, không phải claim sửa lại cơ chế outbox.

Sau sửa, suite đầy đủ (bao gồm 6 test methods mới):

```powershell
python -m unittest discover -s scanner/tests -v
python -m unittest discover -s scripts/ci/tests -v
python -m unittest discover -s scripts/attacker/tests -v
python -m compileall -q scanner alerts scripts/attacker scripts/ci
git diff --check
```

- Scanner/ChatOps/notifier: **33/33 PASS**.
- Repository policy regression: **5/5 PASS**.
- Demo result classification offline: **8/8 PASS**.
- Python syntax và whitespace: **PASS**.
- Git-index policy sau stage: **530 entries, 0 vi phạm**
  (`python scripts/ci/repo_policy.py`). Hosted CI trên exact PR head được ghi
  ở phần kiểm chứng của PR.

## Cách kiểm thử và giới hạn

Các test dùng credential/marker giả, `urlopen` giả lập và state trong thư mục
tạm. Test recovery chạy formatter, sender, chọn kênh, persistence/reload và
backoff thật: thời điểm `1000` gửi Discord thành công/Telegram lỗi, lưu retry
`1010`; gọi mới tại `1011` gửi lại đúng Telegram với cùng payload, không gửi
lại Discord. HTTP, URLError và ValueError được kiểm tra ở cả hai sender.
Suite cũ còn kiểm tra TCP loopback thật.

Không gửi tin Telegram/Discord thật, không kiểm tra AWS hay reboot Ubuntu VM.
Các tiêu chí vận hành/human acceptance còn lại của #43 vẫn cần evidence riêng.
Thay đổi giới hạn ở notifier, test và tài liệu; kiểm chứng này không khẳng định
mọi đường log khác của ChatOps đã được kiểm toán. Human review/final merge
được theo dõi riêng trên PR.
