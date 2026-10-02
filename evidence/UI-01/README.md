# Evidence UI-01 — Nâng cấp toàn diện UI/UX KEVILO Store

- **Tác vụ / Issue:** [#51 — Nâng cấp toàn diện UI/UX KEVILO Store theo phong cách công nghệ premium](https://github.com/LVTIT/PBL4-517/issues/51)
- **Branch:** `feature/51-kevilo-ui`
- **Thời gian thực hiện:** 2026-10-02 (Asia/Bangkok)
- **Môi trường thực nghiệm:**
  - Hệ điều hành: Windows 11 & Ubuntu 24.04 LTS (CI)
  - Node.js: v24.21.0
  - npm: 11.19.0
  - Database: PostgreSQL 16 & Prisma ORM 7.10.0
  - Trình duyệt kiểm thử: Headless Chromium (Playwright v1.63.0)

---

## 1. Kết quả kiểm chứng Phase B0 — Nhận diện thương hiệu KEVILO

- **Tên thương hiệu:** Đã chuyển đổi hoàn toàn tên hiển thị sang **KEVILO** (không còn chuỗi "517 Store" trong nội dung giao diện người dùng).
- **Tagline:** *"Nâng chuẩn góc làm việc."*
- **Logo & Favicon:**
  - Wordmark SVG `KEVILO` viết hoa bằng font Be Vietnam Pro SemiBold.
  - Biểu tượng `K` hình học SVG cho favicon và header mobile.
  - Favicon SVG đặt tại `website/frontend/public/favicon.svg`.
- **Cấu hình thương hiệu tập trung:** Module `website/frontend/src/config/brand.ts` quản lý thống nhất tên, tagline, mô tả, và hàm sinh title trang web (`getPageTitle()`).
- **Bảo toàn định danh kỹ thuật:** Giữ nguyên mã đề tài `PBL4-517`, khóa giỏ hàng `pbl517_cart_*`, cookie `pbl517.sid` và các định danh cơ sở dữ liệu hiện có.
- **Footer disclaimer:** Hiển thị rõ ràng ghi chú demo:
  > *"KEVILO là website demo thuộc đề tài PBL4-517. Không xử lý thanh toán hoặc giao hàng thực tế."*

---

## 2. Hệ thống thiết kế & Bộ ảnh Studio

- **Design System Tokens:**
  - Nền trang: `#F6F7F9`
  - Bề mặt card/form: `#FFFFFF`
  - Chữ chính (Graphite): `#111827`
  - Chữ phụ: `#526071`
  - CTA / Accent: Cobalt `#1D4ED8`
  - Viền phân chia: `#DCE1E8`
  - Bán kính bo góc: Control 10px, Card 16px, Hero 24px
  - Vùng tương tác tối thiểu: 44×44px (đáp ứng WCAG 2.2 Target Size)
- **Typography:**
  - Font **Be Vietnam Pro** (OFL 1.1) tự host 12 file WOFF2 (weights 400, 500, 600, 700 với các subset latin, latin-ext, vietnamese).
  - Không tải phụ thuộc từ Google Fonts runtime để đảm bảo tốc độ và quyền riêng tư.
- **Bộ ảnh Studio AI & Bản quyền:**
  - 1 ảnh hero góc làm việc (`hero-workspace.webp`): 66.8 KB (chuẩn ≤350KB).
  - 10 ảnh studio sản phẩm vuông 800×800 WebP (mỗi ảnh từ 6.6 KB đến 62.4 KB, đạt chuẩn ≤180KB).
  - Hồ sơ nguồn gốc, prompt và giấy phép lưu tại `website/frontend/public/images/IMAGE_PROVENANCE.md`.

---

## 3. Cơ sở dữ liệu & Catalog Importer

- **Prisma Schema Migration:**
  - Migration `20261002000000_add_product_image_key`: thêm cột `imageKey VARCHAR(50)` (nullable) vào bảng `Product`. Cho phép rollback ứng dụng mà không cần drop cột.
- **Catalog Importer độc lập:**
  - Script: `website/backend/src/scripts/import-catalog.ts`.
  - Lệnh: `npm run catalog:import` (mặc định chạy chế độ **dry-run** kiểm tra trước).
  - Thực thi: `npm run catalog:import -- --apply` (upsert theo UUID ổn định, bảo toàn số lượng tồn kho đã thay đổi, không tạo trùng tài khoản hay mật khẩu demo).

---

## 4. Kết quả kiểm thử tự động Playwright & WCAG 2.2 AA (Axe)

Chạy với lệnh `npm run test:e2e` trong `website/frontend`:

```text
Running 28 tests using 2 workers

  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › Home page displays KEVILO brand identity and correct metadata
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Mobile 320px (320px)
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Mobile 390px (390px)
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Tablet 768px (768px)
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Laptop 1024px (1024px)
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Desktop 1440px (1440px)
  ok  [desktop-chrome] › Brand Identity (B0) & Responsive Layout › Mobile navigation drawer opens and closes properly with Escape
  ok  [desktop-chrome] › WCAG 2.2 AA Accessibility Audits › Home page passes automated axe accessibility scan
  ok  [desktop-chrome] › WCAG 2.2 AA Accessibility Audits › Catalog page passes automated accessibility scan
  ok  [desktop-chrome] › Catalog, Search, and Cart Interactions › Catalog synchronizes category filters with URL search params
  ok  [desktop-chrome] › Catalog, Search, and Cart Interactions › Out-of-stock product card shows out-of-stock badge and disables action
  ok  [desktop-chrome] › Catalog, Search, and Cart Interactions › Cart allows adding items and requires valid shipping address
  ok  [desktop-chrome] › Error Resilience & Boundary Handling › Catalog gracefully displays error message and retry button when API fails
  ok  [desktop-chrome] › Error Resilience & Boundary Handling › 404 Not Found page displays KEVILO title and return link
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › Home page displays KEVILO brand identity and correct metadata
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Mobile 320px (320px)
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Mobile 390px (390px)
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Tablet 768px (768px)
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Laptop 1024px (1024px)
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › No horizontal overflow at Desktop 1440px (1440px)
  ok  [mobile-chrome] › Brand Identity (B0) & Responsive Layout › Mobile navigation drawer opens and closes properly with Escape
  ok  [mobile-chrome] › WCAG 2.2 AA Accessibility Audits › Home page passes automated axe accessibility scan
  ok  [mobile-chrome] › WCAG 2.2 AA Accessibility Audits › Catalog page passes automated accessibility scan
  ok  [mobile-chrome] › Catalog, Search, and Cart Interactions › Catalog synchronizes category filters with URL search params
  ok  [mobile-chrome] › Catalog, Search, and Cart Interactions › Out-of-stock product card shows out-of-stock badge and disables action
  ok  [mobile-chrome] › Catalog, Search, and Cart Interactions › Cart allows adding items and requires valid shipping address
  ok  [mobile-chrome] › Error Resilience & Boundary Handling › Catalog gracefully displays error message and retry button when API fails
  ok  [mobile-chrome] › Error Resilience & Boundary Handling › 404 Not Found page displays KEVILO title and return link

  28 passed (16.0s)
```

- **Tỷ lệ đạt:** 28/28 (100% PASS).
- **Trợ năng:** 0 lỗi nghiêm trọng (critical hoặc serious) theo tiêu chuẩn WCAG 2.2 AA.
- **Tràn ngang (Horizontal Overflow):** Hoàn toàn không bị tràn ngang ở mọi kích thước màn hình từ 320px đến 1440px.

---

## 5. Kiểm tra an toàn mã nguồn & CI

- `python scripts/ci/repo_policy.py`: 0 violations.
- `python -m unittest discover -s scripts/ci/tests -v`: 5/5 tests PASS.
- `python -m unittest discover -s .agents/skills/ui-ux-pro-max/scripts/tests -p test_core.py -v`: 39/39 tests PASS.
- `npm run build` (backend): PASS.
- `npm run build` (frontend): PASS (bundle size: CSS ~30.9KB, JS ~360KB).
- `npm audit --audit-level=high`: 0 lỗ hổng nghiêm trọng ở cả 2 project.

---

## 6. Hướng dẫn bàn giao & Triển khai EC2

**Đã được kiểm tra lại:** Xem [audit nhánh, CI và EC2](deployment-audit.md).
EC2 chưa deploy UI mới và đang detached HEAD tại `e0f783b`. Các bước dưới đây
là hướng dẫn dự kiến sau review/merge và phê duyệt production; không phải bằng
chứng đã triển khai. Dùng exact tested commit thay cho `git pull` trên server.
Lệnh setup/build canonical ở [website README](../../website/README.md#build).

1. **Chuẩn bị trước khi phát hành:**
   - Sau khi PR được Team Leader phê duyệt và hợp nhất vào `main`.
   - Kết nối SSH vào máy chủ EC2 Singapore.
2. **Các bước trên EC2:**
   ```bash
   cd /var/www/pbl4-517
   # Sau khi xác nhận working tree sạch và commit đã qua CI/phê duyệt:
   git fetch origin
   git checkout --detach <approved-tested-commit-sha>
   cd website/backend
   npm ci
   npm run build
   npm run prisma:migrate
   npm run catalog:import
   # Chỉ apply sau khi kiểm tra dry-run và duyệt catalog của bản phát hành:
   npm run catalog:import -- --apply
   sudo systemctl restart pbl4-backend
   cd ../frontend
   npm ci
   npm run build
   ```
3. **Rollback plan:**
   - Trong trường hợp cần quay lại phiên bản trước: `git checkout <previous-sha>` và rebuild.
   - Do migration thêm cột nullable `imageKey`, phiên bản backend trước vẫn hoạt động bình thường mà không cần drop cột database hay can thiệp vào các đơn hàng hiện có.
