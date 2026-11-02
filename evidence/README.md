# Evidence index

Bằng chứng lịch sử giữ đường dẫn để các Issue/PR vẫn đối chiếu được. Mỗi README
nêu revision, môi trường, ngày, kết quả và giới hạn; không suy ra trạng thái hiện tại
chỉ từ evidence cũ. Tổng hợp tại [CURRENT_STATUS](../wiki/CURRENT_STATUS.md).

| Mã | Nội dung |
| --- | --- |
| [Local runtime #68](DEVTOOLS-01/local-runtime-20261102/README.md) | Compose consolidation, clean setup, lifecycle and demo verification |
| [AWS-02](AWS-02/README.md) | AWS-02 evidence — Issue #6 |
| [AWS-03](AWS-03/README.md) | AWS-03 evidence — Issue #12 |
| [DEVOPS-01](DEVOPS-01/README.md) | DEVOPS-01 — CI verification evidence |
| [DEVTOOLS-01](DEVTOOLS-01/README.md) | Issue closure audit and UI UX Pro Max installation |
| [LINUX-02](LINUX-02/README.md) | LINUX-02 — Issue #15 service evidence |
| [MON-03](MON-03/README.md) | Monitoring reliability ? Refs #43 |
| [OWASP-01](OWASP-01/README.md) | OWASP-01 Evidence — A01:2021 Broken Access Control (IDOR) |
| [OWASP-02](OWASP-02/README.md) | OWASP-02 Evidence — A03:2021 Injection (SQL Injection) |
| [OWASP-03](OWASP-03/README.md) | Stored XSS local lifecycle ? Refs #38 |
| [OWASP-04](OWASP-04/README.md) | Authentication local lifecycle ? Refs #40 |
| [SCAN-01](SCAN-01/README.md) | SCAN-01 Evidence — Issue #10: External Security Scanner & Dual-Channel Alerts |
| [UI-01](UI-01/README.md) | Evidence UI-01 — Nâng cấp toàn diện UI/UX KEVILO Store |
| [WEB-04](WEB-04/README.md) | WEB-04 — Issue #14 deployment evidence |

Dữ liệu chạy mới vào `.local/reports/`, logs/state vào `.local/runtime/`, credential
vào `.local/private/`. Chỉ đưa evidence đã rà soát/redact vào đây; không commit
cookie/token, `.env`, fixture manifest chứa mật khẩu hoặc database dump.
