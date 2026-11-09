# Hợp nhất monitoring fixes vào PR #72 — Refs #43

## Đối chiếu phạm vi

Ngày 2026-11-09, người dùng yêu cầu kiểm tra các PR trùng phạm vi và gộp vào PR
phù hợp. Ba PR cùng issue #43 xử lý các lỗi trong luồng scanner → outbox → sender:

| PR / commit gốc | Lỗi được sửa | Regression |
| --- | --- | --- |
| #72 / `d0ccdd7d2056da5a44c9aa79a880c63b26991322` | Partial scan xóa uncertainty của cổng chưa quét, gây recovery/exit 0 giả | 4 methods |
| #73 / `c49fc20552fa36cc7ba05d08132b9ef2a7eb5412` | Self-test sender báo exit 0 dù gửi lỗi, log exception có thể chứa credential | 6 methods |
| #74 / `fd894b230430ca5c24bd5318764176af9793e116` | Target DNS lỗi khiến outbox không được retry | 8 methods |

Các bản sửa bổ sung nhau và có chung README/status cần giải quyết conflict.
PR #72 được chọn làm PR tổng. Hai feature branch được merge vào nhánh #72,
giữ nguyên commit gốc, test và evidence. Merge trung gian `af0ef25` tích hợp #73;
`9244875` tích hợp #74. Conflict chỉ nằm ở README/status và được giải quyết bằng
cách giữ đủ hành vi của cả ba bản sửa, gồm quy tắc exit của partial scan.

## Kiểm chứng tích hợp local

- Base main: `6c1167b0dea0d5249d2a175f496c90dbfba9538d`.
- Source tích hợp đã test: `9244875`; commit tài liệu sau đó không sửa runtime/test.
- Môi trường: Windows PowerShell, Python 3.13.13.

| Kiểm tra | Kết quả |
| --- | --- |
| Toàn bộ scanner / ChatOps / notifier | **45/45 PASS** (27 có sẵn + 4 + 6 + 8) |
| Policy regression | **5/5 PASS** |
| Demo classification offline | **8/8 PASS** |
| Python compileall | PASS |
| Đối chiếu AST và blob runtime/test | PASS |

Đối chiếu bằng `ast.dump(..., include_attributes=False)` từng function trong
`scanner/scan.py`: `evaluate_diff_and_notify` và `_run_single_scan` bằng #72;
`main` và `handle_dns_failure` bằng #74; mọi function khác bằng main. File
`alerts/notifier.py` và ba file regression tương ứng bằng byte-for-byte blob của
PR gốc. Lệnh `git merge-base --is-ancestor` dùng để xác nhận các commit gốc còn
trong lịch sử PR tổng trước khi đóng PR được thay thế.

```powershell
python -m unittest discover -s scanner/tests -v
python -m unittest discover -s scripts/ci/tests -v
python -m unittest discover -s scripts/attacker/tests -v
python -m compileall -q scanner alerts scripts/attacker scripts/ci
python scripts/ci/repo_policy.py
git diff --cached --check
```

Required CI chạy lại trên head mới của [PR #72](https://github.com/LVTIT/PBL4-517/pull/72);
không dùng kết quả CI của ba head cũ làm nghiệm thu cho tổ hợp mới. Exact final
head, run URL và kết quả năm required checks được ghi trên PR khi CI hoàn tất.
PR #73/#74 được thay thế bởi #72 sau khi xác nhận đã push đủ thay đổi và CI PASS.

## Evidence gốc và giới hạn

- [Partial-scan: tái hiện trước/sau](../partial-scan-20261104/README.md).
- [Notifier: exit status, log và transport recovery](../alert-delivery-20261109/README.md).
- [DNS: outbox retry và watch recovery](../dns-alert-recovery-20261109/README.md).

Test mới dùng state/lock/persistence/audit thật với DNS/probe/transport giả lập;
suite hiện có còn kiểm tra loopback socket thật. Kết quả local/CI và human review
được theo dõi riêng. Issue #43 vẫn mở với các tiêu chí external Ubuntu VM
scheduler/reboot, real-channel receipts và human acceptance còn lại. Team Leader /
Repository Owner thực hiện final merge sau review.
