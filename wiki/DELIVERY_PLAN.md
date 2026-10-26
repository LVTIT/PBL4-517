# Kế hoạch hoàn thiện PBL4-517

Ngày đối chiếu: **2026-10-26**. Refs #43, #44, #45, #46.
Kế hoạch này cụ thể hóa hướng dẫn của giảng viên và kế hoạch bảy bước người dùng
cung cấp. Tiến độ tổng hợp được duy trì tại [CURRENT_STATUS.md](CURRENT_STATUS.md);
bằng chứng kiểm thử nằm trong `evidence/`. Không coi kế hoạch là kết quả nghiệm thu.

## Mục tiêu và phạm vi

Sản phẩm cần chứng minh một chu trình hoàn chỉnh:

**Website trên Linux/AWS → scanner bên ngoài → phát hiện/cảnh báo → khai thác trong
lab được phép → vá lỗi → dùng lại cùng kịch bản để kiểm thử → lưu bằng chứng.**

Website KEVILO là ứng dụng phục vụ chu trình đó. Giữ stack React/TypeScript/Vite,
Express, PostgreSQL/Prisma và Python standard library theo quyết định Accepted.
PHP, DVWA, Juice Shop, nmap và các repository được thầy nêu là lựa chọn tham khảo;
không cần xây lại phần tương đương đã có. Tạm ưu tiên chất lượng lab/vận hành hơn
thêm payment, tính năng bán hàng hoặc tiếp tục mở rộng giao diện.

## Đối chiếu bảy bước với phần đã có

| Bước | Hiện trạng đã có bằng chứng | Phần cần hoàn thiện |
| --- | --- | --- |
| 1. Nền website #51 | Vá dependencies, bỏ API fallback giả, cô lập xác nhận đơn theo tài khoản; PR #55 đã merge; regression local và main CI sau #56 PASS | Giữ regression trên revision tích hợp; hoàn tất nghiệm thu đầy đủ catalog/UI/deployed và human acceptance của #51 |
| 2. IDOR #24/#44 | Kịch bản đọc/sửa/hủy bằng hai tài khoản; kiểm tra DB và tồn kho trước/sau trong suite local | Giữ cùng payload ở hai chế độ; trình diễn và ghi revision thực tế khi bàn giao |
| 3. SQLi #37 | Đã tích hợp từ `59b75f3`/PR #47 qua PR #56 vào main; có tautology/UNION và truy vấn Prisma an toàn | Xác nhận review/nghiệm thu của issue và bàn giao evidence; không cherry-pick trùng lần nữa |
| 4. Stored XSS #38 | Review lưu PostgreSQL, marker vô hại chạy trong browser lab; secure mode hiển thị text | Giữ browser regression, giải thích nguồn dữ liệu và escaping; human review |
| 5. Authentication #40 | Lab bỏ login limiter; baseline chặn bằng 429; session/CSRF/bcrypt vẫn có | Đối chiếu thêm kiểm tra login/logout/session trong suite API; không dùng cùng IP đang bị khóa để suy ra login hợp lệ bị hỏng |
| 6. Monitoring #35/#36/#43 | Scanner, baseline, retry từng kênh, lock, audit rotation và systemd template có source; PR #57 sửa recovery/ChatOps với 27 local checks; bằng chứng gửi thật cũ đã có | Tích hợp/review #57 sau cập nhật main; cài và reboot Ubuntu VM thật; thu receipt hai kênh mới |
| 7. Regression/evidence #44/#45/#46 | Ma trận local cho IDOR/SQLi/XSS/auth, browser checkout và scanner | Bộ bằng chứng cùng revision, kết quả AWS/VM, đối chiếu Linux log và human handoff |

Nguồn baseline: [website local](../evidence/UI-01/local-baseline-20261025/README.md),
[ma trận security local](../evidence/TEST-02/local-20261025/README.md),
[IDOR](../evidence/OWASP-01/README.md), [monitoring](../evidence/MON-03/README.md).
PR #55 và #56 đã merge; main `5a7abb7` PASS đủ năm CI jobs ngày 26/10.
PR #57 đang được cập nhật từ main. Kết quả CI phải khớp revision mới nhất của
chính PR #57, không suy từ các run của commit cha.

## Thứ tự thực hiện tiếp

| Ưu tiên | Công việc / Issue | Đầu ra và điều kiện đạt |
| --- | --- | --- |
| P0 — tích hợp/review | Monitoring #43 / PR #57 | Các sửa lỗi đã implemented và local verified: queue recovery, due events, audit/state validation, ChatOps chat + sender + target. Giải conflict, kiểm chứng revision mới và human review; issue #43 vẫn cần nghiệm thu VM thật |
| P1 — giữ regression | Kiểm chứng bước 1–5 và 7, #44/#45 | Local matrix và main CI sau #56 PASS; cập nhật evidence cho revision #57. Fresh install/build/audit; DB thử riêng; API, UI và security lifecycle; không đổi `.env` hay dữ liệu thật |
| P2 — hạ tầng hiện hành | #16/#17/#33 | Đọc cấu hình VPC/subnet/route/IGW/SG/NACL thật; HTTPS/service smoke; bảng 22/80/443/3000/5432/8080 từ nguồn được phép; sơ đồ khớp AWS. Bằng chứng triển khai cũ phải giữ ngày và revision gốc |
| P3 — external monitor | #35/#36/#43 | Ubuntu VM nằm ngoài EC2; timer chạy ít nhất hai lần, state tồn tại; lỗi mạng/kênh gửi và recovery; receipt Telegram/Discord thật; reboot VM rồi xác minh lịch/audit tiếp tục |
| P4 — A05 và log | #41/#42 | Listener lab vô hại, SG chỉ nguồn scanner /32 theo runbook; before → detect/alert → harden → rescan; đối chiếu rule/listener và HTTP/SSH/journal. Xóa rule/listener lab; backend/DB vẫn không public |
| P5 — thiết kế ALB | #34/#39 | Sơ đồ Internet → ALB → Nginx/EC2, listener/target-group/health-check/SG; so sánh với truy cập trực tiếp; ước tính chi phí trước khi tạo resource. Live ALB chỉ sau phê duyệt chi phí theo Issue #34 |
| P6 — bàn giao | #44/#45/#46 | Chạy lại toàn bộ trên revision chốt, cập nhật evidence/index, hosted CI và human review; demo cùng payload trước/sau vá; người học tự xác nhận hiểu và thao tác được |

P2–P5 cần thông tin/quyền truy cập hạ tầng thật và cửa sổ lab tương ứng; full access
trên máy local không thay thế quyền AWS, quyền quét target hoặc phê duyệt chi phí.
Không tự đổi SG/NACL, reboot máy dùng chung hay tạo resource chỉ từ kế hoạch này.

## Kiến trúc cần giải thích khi bảo vệ

- **Hiện đã triển khai theo evidence cũ:** một EC2 Ubuntu, Nginx public, Express và
  PostgreSQL chỉ loopback. Đây chưa phải kiến trúc database ở private subnet riêng.
- **Cần xác minh #33:** VPC, subnet, route table, IGW và các rule SG/NACL đang dùng.
  SG là stateful; NACL ở cấp subnet và stateless nên cần xét cả chiều phản hồi.
  [AWS SG](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html),
  [AWS NACL](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html).
- **Proposed khi cần mở rộng:** ALB public với EC2 phía sau; database tách sang
  private subnet nếu nhóm chọn kiến trúc nhiều tầng. Cần chốt topology, đường quản
  trị, TLS, health-check, backup và chi phí trước triển khai. ALB phân phối request
  tới các target khỏe, không tự vá SQLi/XSS/IDOR.
  [AWS ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html).
- Baseline trực tiếp EC2: 80/443 public theo kiến trúc; SSH chỉ IP quản trị; không
  public 3000/5432. Lab 8080 phải có thời hạn và rollback. Sau lab, timeout/filtered
  chỉ nói không kết nối được từ điểm quét, không chứng minh service đã dừng.

## Quy ước demo và evidence

1. Ghi phiên bản OWASP **Top 10:2021** cho mapping đang dùng: A01 IDOR, A03 SQLi/XSS,
   A07 authentication, A05 misconfiguration. Trang OWASP hiện có bản 2025; không
   trộn số nhóm giữa các phiên bản. [OWASP](https://owasp.org/www-project-top-ten/).
2. Mỗi scenario ghi branch/commit, working-tree diff nếu chưa commit, môi trường,
   target được phép, dữ liệu giả, payload, kết quả mong đợi/thực tế và kiểm tra
   chức năng hợp lệ sau vá. Dùng cùng payload cho vulnerable và secure.
3. IDOR phải so DB/stock; SQLi kiểm tra literal search/filter; XSS phải kiểm tra
   trình duyệt thật; auth phải kiểm tra limiter và session/logout riêng; A05 phải
   có AWS rules và listener bên cạnh scan. Quét port không phát hiện đủ các lỗi web.
4. Giữ baseline mặc định an toàn, mọi lab flag false và production từ chối bật
   lab. Các lab chỉ ở môi trường cô lập; không mang cấu hình IDOR demo triển khai
   cũ vào production mới. [Security plan](SECURITY_PLAN.md).
5. Evidence không chứa token, cookie, khóa hay PII; không tick human review/demo
   hoặc đóng Issue dựa vào source/test. Mỗi task qua feature branch và PR, owner
   thực hiện merge sau CI/review theo [Development](DEVELOPMENT.md).

Lệnh cài/chạy/test được giữ ở [website README](../website/README.md),
[scanner README](../scanner/README.md) và [VM runbook](../scanner/systemd/README.md).
