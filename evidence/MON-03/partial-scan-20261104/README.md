# Giữ trạng thái chưa xác định khi quét từng nhóm cổng — 2026-11-04

Refs #43. Nhánh: `feature/43-preserve-partial-scan-uncertainty`.
Base: `main` tại `6c1167b`. Trạng thái: **đã triển khai và kiểm chứng local**;
SHA bàn giao, hosted CI và human review được ghi trên PR liên kết Issue #43.

## Lỗi đã tái hiện

Scanner và ChatOps có thể dùng chung state nhưng chọn danh sách cổng khác nhau.
`evaluate_diff_and_notify()` trước đây thay toàn bộ `uncertain_ports` bằng kết quả
chưa xác định của riêng lần quét hiện tại. Vì vậy, quét thành công một cổng không
liên quan cũng có thể xóa timeout đã lưu và gửi cảnh báo phục hồi sai.

| Lần quét cùng target | Kết quả giả lập có kiểm soát | Code cũ | Sau sửa |
| --- | --- | --- | --- |
| 1 | `80: open`, `5432: filtered` | Lưu `[5432]`, exit 1 | Lưu `[5432]`, exit 1 |
| 2 | Chỉ `80: open` | Xóa timeout `5432`, `SCAN_RECOVERED`, exit 0 | Giữ `[5432]`, `NO_CHANGE`, exit 1 |
| 3 | Chỉ `5432: closed` | `NO_CHANGE`, exit 0 | Xóa timeout sau kiểm tra đúng cổng, `SCAN_RECOVERED`, exit 0 |

`closed` trong ví dụ là kết nối bị từ chối rõ ràng, không suy từ timeout hay từ
thay đổi Security Group. Exit 0 chỉ mô tả trạng thái quan sát/pending delivery
đang lưu, không chứng minh target không còn lỗ hổng.

## Thay đổi code

- `scanner/scan.py`: chỉ thay trạng thái chưa xác định của các cổng thực sự có
  trong kết quả hiện tại. Giữ lại các cổng chưa được quét lại, kể cả khi reset
  baseline của một nhóm cổng. Chỉ hết uncertainty khi từng cổng đã có kết quả
  `open` hoặc `closed`.
- Audit của mỗi scan thành công có thêm `uncertain_ports`, bên cạnh `results`
  của lần quét hiện tại. Trường này giải thích được exit 1 khi chỉ quét Web thành
  công nhưng vẫn còn timeout cũ trên cổng khác.
- `scanner/tests/test_partial_scans.py`: bốn regression kiểm tra cảnh báo giả,
  nhiều nhóm timeout độc lập, subset reset và CLI exit/audit qua ba lần đọc/ghi
  state liên tiếp. Giữ nguyên các kiểm thử hiện có.
- `scanner/README.md`: cập nhật ý nghĩa exit code, partial scan, audit và cách
  quét lại các cổng còn chưa xác định. Định dạng state hiện tại tương thích, không
  cần migration.

## Môi trường và lệnh kiểm chứng

Windows PowerShell, Python 3.13.13. Các kết quả mới được tạo trên working tree
của nhánh nêu trên dựa vào `6c1167b`; xem diff/commit PR để xác định exact delivery
SHA. Không coi metadata của working tree đang sửa là artifact triển khai sạch.

### Trước sửa code scanner

Thêm bốn regression, giữ `scanner/scan.py` nguyên trạng từ main rồi chạy:

```powershell
python -m unittest discover -s scanner/tests -p test_partial_scans.py -v
```

**4/4 FAIL đúng lỗi cần sửa**, không phải import/setup error.
[Log trước sửa](before-fix.txt) ghi nhận: exit `[1, 0, 0]` thay vì `[1, 1, 0]`,
timeout cũ bị mất, phát sinh `SCAN_RECOVERED` khi chỉ quét cổng khác và subset
reset xóa uncertainty của cổng chưa quét. Đây là negative control trên code thật.

### Sau sửa

```powershell
python -m unittest discover -s scanner/tests -v
python -m compileall -q scanner alerts scripts/attacker scripts/ci
python -m unittest discover -s scripts/attacker/tests -v
python -m unittest discover -s scripts/ci/tests -v
python scripts/ci/repo_policy.py
git diff --check
```

| Kiểm tra | Kết quả local |
| --- | --- |
| Scanner/ChatOps, gồm bốn regression mới | **31/31 PASS** — [log sau sửa](after-fix.txt) |
| Python compileall | PASS |
| Phân loại kết quả demo offline | 8/8 PASS |
| CI policy regression | 5/5 PASS |

Repository policy, whitespace và local Markdown links được kiểm tra trước commit;
kết quả bàn giao và năm required hosted checks ghi trên PR để gắn đúng latest SHA.
CI hiện có đã discover toàn bộ `scanner/tests`, bao gồm file regression mới.

## Phạm vi bằng chứng và công việc còn lại của #43

Các test mới chỉ dùng state tạm và kết quả port/alert giả lập có kiểm soát; suite
cũ còn có loopback socket thật. Không có scan Internet hoặc tin nhắn chat thật
trong lần kiểm chứng này. CLI test chạy parser, state lock/persistence, diff,
exit status và audit thật; DNS/probe/report renderer được mock để kết quả không
phụ thuộc firewall hay dịch vụ đang chạy trên máy.

Issue #43 vẫn cần xác minh scheduler trên external Ubuntu VM, reboot recovery,
real Telegram/Discord receipts, controlled channel failure/recovery và human
review/operational acceptance theo issue. Bản sửa local này không hoàn tất các
tiêu chí đó. Final merge thuộc Team Leader/Repository Owner sau human review.
