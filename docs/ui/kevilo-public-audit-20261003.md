# KEVILO — kiểm thử website công khai và kế hoạch cải thiện

Ngày: **2026-10-03, Asia/Bangkok**. Website: <https://47.129.214.70/>. Related to #51.

**Kết quả:** Website sử dụng được ở các luồng công khai đã thử. Thiết kế có nhận diện rõ, font tiếng Việt tốt và nhiều trạng thái lỗi đã được xử lý. Tuy nhiên, ảnh sai sản phẩm, giỏ hàng mobile tràn ngang, focus menu và phản hồi thêm giỏ chưa chính xác là các vấn đề cần sửa trước khi xem đợt UI này hoàn tất.

**Trạng thái tại thời điểm audit gốc:** Kiểm thử và lập báo cáo đã thực hiện. Các thay đổi dưới đây khi đó là **Proposed**, ngoại trừ F13/F14 **Planned** theo yêu cầu trực tiếp của người dùng. Đây không phải chứng nhận WCAG hoặc kiểm thử bảo mật toàn hệ thống. Không thay đổi ứng dụng, database hoặc cấu hình production trong lượt audit gốc.

**Cập nhật bàn giao source 2026-10-03:** Source đã có các cải tiến F01–F13, gồm grid mobile 2 cột, giỏ mobile, bộ lọc/focus/form, lưu xác nhận đơn và chia chunk. Frontend/backend build PASS, 40/40 lượt UI test PASS local. Đây là implementation một phần và kiểm thử với fixture; chưa hoàn tất mọi DoD. Còn kiểm duyệt toàn bộ ảnh, cô lập item kiểm chứng theo quyền (cờ API public vẫn đọc được), nền drawer inert, cô lập xác nhận đơn khi đổi tài khoản, các trạng thái/breakpoint còn thiếu và đo lại LCP. **F14 vẫn Planned:** mock UI tests và fallback Vite còn hiện hữu, chưa có nghiệm thu thật từ đầu đến cuối. Chưa deploy source mới hoặc xác nhận human review. [Bằng chứng kiểm chứng source](../../evidence/UI-01/public-audit-20261003/commit-verification.md). Findings/ảnh/số đo bên dưới được giữ như bằng chứng lịch sử của website đã audit.

## Phạm vi và bằng chứng

- Đọc wiki, README website, quyết định KEVILO, skill UI UX Pro Max và [Issue #51](https://github.com/LVTIT/PBL4-517/issues/51); kiểm tra source tại `9f758792aa13c7b402dd3699cd96aaf518e7bffa`. [PR #52](https://github.com/LVTIT/PBL4-517/pull/52) OPEN tại thời điểm đọc API GitHub.
- Kiểm tra website thật bằng Playwright/Chromium `153.0.8010.12`, Node `24.21.0`, Windows. HTTPS được xác thực bình thường, không bỏ qua lỗi chứng chỉ.
- Home, Catalog, Product detail, Login, Register, 404 và giỏ có sản phẩm: **14 lượt quét axe** ở desktop 1440px và mobile 390px, **0 violation tự động**. Có kết quả `incomplete` cần xem thủ công; không diễn giải thành toàn bộ WCAG PASS.
- Home, Catalog, Product detail, giỏ có sản phẩm: 20 trạng thái ở 320/390/768/1024/1440px. Giỏ FAIL ở 320 và 390px; ba trang còn lại không tràn toàn trang trong các trạng thái đã thử. Dải danh mục cuộn ngang là vùng cuộn có chủ đích.
- Thử lọc, tìm kiếm không có kết quả, sort, refresh URL, thêm/xóa giỏ, tồn kho tối đa, menu bằng bàn phím, form sai, API lỗi/thử lại, và trang yêu cầu đăng nhập/quyền admin.
- Header CUSTOMER/ADMIN được **mô phỏng riêng tại `/api/auth/me`**; không chứng minh đăng nhập/RBAC backend. Checkout success được **mô phỏng tại `/api/orders`**; không có đơn thật hoặc thay đổi tồn kho. Không đăng ký tài khoản thật, không dùng tài khoản demo công khai.
- Home mobile cold load: 3 lần mô phỏng 1,6 Mbps download, RTT đặt 150ms, CPU chậm 4×. Đây là số đo lab, không phải Lighthouse score hoặc số liệu người dùng thực.
- JS/CSS đang phục vụ và cả 10 ảnh sản phẩm khớp byte với build/assets trong checkout. Điều này không xác minh SHA backend trên EC2.

[Bằng chứng, ảnh và script tái hiện](../../evidence/UI-01/public-audit-20261003/README.md).

## Những điểm đã kiểm chứng tốt

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| HTTPS, trang công khai, health | Truy cập thành công; health báo `ok` và database `connected` |
| Nội dung/catalog | API có 11 dòng; 10 sản phẩm KEVILO và 1 dòng kiểm chứng triển khai |
| Lọc Bàn phím | 2 sản phẩm đúng danh mục, query URL đúng |
| Sort tăng giá + refresh | Giá tăng từ 10.000 đến 1.290.000 VND; lựa chọn sort giữ sau reload |
| Tìm không có kết quả | Có giải thích và nút xóa bộ lọc |
| Giỏ + refresh | Sản phẩm/số lượng được giữ trong phiên khách |
| Login sai | Thông báo chung “Email hoặc mật khẩu không đúng.”; mật khẩu được xóa; show/hide hoạt động |
| Register xác nhận mật khẩu sai | Chặn ở client, không tạo tài khoản |
| Catalog API lỗi | Có thông báo và Thử lại; khôi phục được 11 card sau bỏ lỗi mô phỏng |
| Menu Escape | Đóng menu và trả focus về nút mở menu |
| Ảnh lazy-load | Sau cuộn, cả 10 ảnh tải thành công; khoảng trống trong screenshot chưa cuộn không phải bằng chứng ảnh hỏng |
| Trang sản phẩm/404 | Có nội dung và đường quay lại; chi tiết sản phẩm 0 review không dựng điểm đánh giá giả |
| Console ở lượt tải bình thường | Không ghi nhận uncaught JS error hoặc HTTP lỗi trong 14 trạng thái baseline |

## Các sai sót và tiêu chí sửa

P1: ảnh hưởng trực tiếp việc chọn hàng, thao tác hoặc trợ năng, ưu tiên trước demo hoàn thiện UI. P2: cải thiện độ rõ ràng, tốc độ và độ bền của hành trình. Chưa xác nhận lỗi P0 trong phạm vi này.

### F01 — P1: ảnh không mô tả đúng sản phẩm

**Observed:** Hub USB-C dùng ảnh màn hình/góc máy tính; giá đỡ laptop dùng ảnh iMac; thảm bàn dùng ảnh bàn phím. Ngoài ra, chuột mô tả công thái học/vertical dùng ảnh chuột gaming có dây, và SoundBar dùng ảnh loa thùng. Nền vàng/RGB xen với ảnh studio xám cũng làm bộ catalog thiếu thống nhất.

Ảnh website và ảnh repository có hash giống nhau: vấn đề nằm trong tài nguyên đang chọn, không phải lỗi tải hoặc cache. [Ảnh bằng chứng](../../evidence/UI-01/public-audit-20261003/product-mismatch-1-390.png); danh sách hash trong `extended.json`.

**Proposed:** Kiểm duyệt lại cả 10 ảnh theo tên, loại và đặc tính sản phẩm; thay ảnh sai, thống nhất nền/ánh sáng/góc chụp, giữ các `imageKey` và ID. Ghi nguồn thực tế và thông số trong `IMAGE_PROVENANCE.md`; hiện mô tả “studio/neutral” của một số dòng không khớp ảnh. Tuyên bố “10 ảnh AI” chưa được audit này xác minh.

**DoD:** Mỗi ảnh nhận diện đúng mặt hàng và đặc tính được mô tả; người review đối chiếu ảnh/tên/mô tả từng dòng. Không coi ảnh đúng kích thước/hash là đủ. WebP vẫn đạt ngân sách Accepted; không phát sinh ảnh lỗi ở card, detail, cart.

### F02 — P1: dữ liệu kiểm chứng xuất hiện đầu catalog bán hàng

**Observed:** “Deployment verification item - NOT FOR SALE” xuất hiện đầu danh sách với giá 10.000 VND, danh mục tiếng Anh và ảnh fallback. Sort giá tăng tiếp tục đẩy dòng này lên đầu. Đèn Focus hết hàng là sản phẩm catalog thật, không nên loại cùng dòng kiểm chứng.

**Proposed:** Tách điều kiện công bố storefront khỏi tồn kho. Thiết kế trường/trạng thái công bố hoặc quy tắc catalog rõ ràng, áp dụng thống nhất ở API list/search/detail và UI quản trị. Bảo toàn dòng kiểm chứng, lịch sử/evidence và liên kết đơn; không xóa database để làm sạch giao diện. Thay đổi schema, nếu chọn, cần migration/review riêng.

**DoD:** Catalog công khai hiện 10 sản phẩm KEVILO; dòng nội bộ không hiện qua list/search/detail công khai theo chính sách đã review. Sản phẩm KEVILO hết hàng vẫn có nhãn và nút bị khóa. Kiểm tra cả “Tất cả”, category và sort.

### F03 — P1: giỏ hàng phá vỡ chiều rộng mobile

**Observed:** 320px → `clientWidth=320`, `scrollWidth=399`; 390px → `clientWidth=390`, `scrollWidth=399`. Card mở rộng tới khoảng 399,34px. Tên bàn phím bị ép thành nhiều dòng; nhóm ảnh + tên + quantity + xóa đặt chung một hàng. [Giỏ 320px](../../evidence/UI-01/public-audit-20261003/cart-verified-320.png), [giỏ 390px](../../evidence/UI-01/public-audit-20261003/cart-verified-390.png).

**Proposed:** Mobile đặt ảnh/tên/giá ở hàng đầu, quantity và xóa ở hàng riêng; giảm padding theo breakpoint và cho grid child co lại bằng `min-width: 0`/`minmax(0, 1fr)`. Kiểm tra summary/total với giá dài. Không dùng `overflow-x: hidden` để che lỗi.

**DoD:** Không tràn ở tất cả 5 breakpoint, cả giỏ 1/nhiều sản phẩm, tên dài và quantity tối đa; thông tin và nút không bị cắt.

### F04 — P1: vùng bấm nhỏ hơn chuẩn của dự án

**Observed:** Quantity và xóa trong cart là 36×36px; CTA `+ Giỏ hàng` và filter pill cao 38px. Nút điều khiển số lượng ở detail đã là 44px.

**Proposed:** Chuẩn hóa hit area tối thiểu 44×44px cho các điều khiển rời này, kể cả khi hình/icon bên trong nhỏ; bỏ override inline 36px và điều chỉnh `.button-small`/filter.

**DoD:** Đo bounding box khi font tải xong và kiểm tra chạm không nhầm ở 320/390px. **44px là chuẩn Accepted của dự án**; không suy từ 36px thành tự động vi phạm WCAG 2.2 AA: tiêu chí [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) có mức 24px và ngoại lệ về khoảng cách/inline.

### F05 — P1: menu mobile không giữ focus bên trong

**Observed:** Mở menu xong focus vẫn ở nút ngoài dialog. Sau 6 mục trong drawer, Tab tiếp tục tới CTA và danh mục của trang phía sau; nội dung nền vẫn tương tác được bằng bàn phím. Escape PASS.

**Proposed:** Đưa focus vào drawer lúc mở; giữ vòng Tab/Shift+Tab trong dialog; làm nền inert; trả focus cho nút mở khi đóng bằng mọi cách. Review cùng component `ConfirmDialog`: source có trả focus nhưng chưa có vòng focus; chưa thử hộp thoại hủy đơn với tài khoản thật.

**DoD:** Kiểm tra mở/Tab/Shift+Tab/Escape/nút đóng/click nền, focus visible và nền không tương tác khi modal mở. Hành vi này theo [WAI Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### F06 — P1: thông báo thêm giỏ báo thành công khi không thêm

**Observed:** Giỏ chứa 17 bàn phím, bằng stock API=17. Bấm thêm vẫn toast “Đã thêm…” trong khi cart giữ 17.

**Proposed:** `addToCart` trả kết quả và số lượng thực thêm; toast dựa trên kết quả. Báo “Bạn đã chọn đủ số lượng hiện có” nếu thêm 0, hoặc nêu số lượng thực khi chỉ thêm được một phần. Nút/detail thể hiện phần stock còn có thể thêm. Đồng bộ lại stock/giá khi vào cart; server vẫn là nơi xác minh đặt hàng.

**DoD:** Cover stock=0, cart=stock, thêm vượt phần còn lại, stock/giá đổi sau lần lưu giỏ. Thông báo, tổng và số lượng khớp kết quả; không ghi nhận thay đổi giả.

### F07 — P2: xóa bộ lọc bị debounce khôi phục từ khóa cũ

**Observed:** Đang ở trang không có kết quả, gõ `chuột`, bấm “Xóa tất cả bộ lọc” trước 300ms. URL về `/products` rồi tự trở thành `/products?search=chuột`, input trở lại `chuột` và chỉ còn 2 kết quả.

**Proposed:** Hủy timer khi reset và khi unmount; bảo đảm reset/Back/Forward và kết quả request cũ không ghi đè ý định mới.

**DoD:** Sau reset trong lúc debounce pending, URL/input/kết quả vẫn ở trạng thái không lọc sau ít nhất một chu kỳ debounce. Test phản hồi request đảo thứ tự và Back/Forward.

### F08 — P2: semantics của filter không khớp hành vi bàn phím

**Observed:** Filter dùng `role=tablist/tab`, nhưng ArrowRight ở “Tất cả” không chuyển focus; không có tabpanel tương ứng.

**Proposed:** Với lọc catalog, ưu tiên nhóm button có `aria-pressed` và tên nhóm rõ ràng. Nếu giữ tabs, triển khai đầy đủ keyboard và quan hệ panel theo [WAI Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Báo số kết quả sau tìm/lọc bằng live region gọn, không đọc lại toàn bộ grid.

**DoD:** Keyboard và screen reader hiểu được lựa chọn hiện tại; danh mục ngoài mép vùng cuộn tự được đưa vào vùng nhìn khi focus/chọn.

### F09 — P2: form báo lỗi nhưng không chỉ dẫn tới ô cần sửa

**Observed:** Mật khẩu xác nhận không khớp hiển thị alert; input xác nhận không có `aria-invalid` hoặc liên kết `aria-describedby`, focus vẫn ở nút submit. Login sai xóa mật khẩu, và focus trong lần thử về body khi các control bị disabled. Checkout guest không có `name`/`autocomplete` trên các ô người nhận/email/phone/address.

**Proposed:** Có lỗi cụ thể cạnh field, liên kết ARIA và focus về field/summary sau submit thất bại; giữ dữ liệu không nhạy cảm; thêm autocomplete phù hợp cho checkout. Với lỗi đăng nhập chung, giữ thông báo chung và focus vào bước sửa hợp lý, không suy đoán tài khoản tồn tại.

**DoD:** Người chỉ dùng keyboard sửa được form mà không tìm lại từ đầu; thông báo được đọc đúng field. Test required/email/password mismatch/network lỗi và không submit lặp.

### F10 — P2: luồng khách đặt hàng dễ mất thông tin xác nhận

**Observed trong mô phỏng response success:** Thành công hiển thị mã đơn và dặn khách tự chụp/lưu. Reload `/cart` trả về giỏ trống và mất màn hình xác nhận. Đây là test frontend, không xác minh tạo đơn/nhận email thật. Label “Email nhận thông báo” tạo kỳ vọng gửi email, nhưng source được đọc chỉ lưu email; chưa thấy triển khai gửi mail.

**Proposed:** Thêm sao chép mã và tải/in xác nhận. Đề xuất xác nhận có thể khôi phục trong phiên được bảo vệ; không lưu toàn bộ PII vào localStorage hoặc tạo endpoint tra cứu công khai chỉ bằng ID đơn. Đổi label thành “Email liên hệ” nếu chưa có gửi mail, nêu rõ tính chất demo ngay trước CTA. Trang thành công chuyển focus tới heading và thông báo trạng thái.

**DoD:** Test reload và hướng dẫn khách tìm lại xác nhận theo chính sách được review; đăng ký sau checkout không hứa tự gắn đơn cũ nếu chưa có implementation. API thật/ownership/idempotency được test trên môi trường riêng trước tuyên bố hoàn tất.

### F11 — P2: LCP mobile còn chậm; static JS/CSS chưa nén

**Observed:** LCP 3.392 / 3.396 / 3.384 giây, median **3.392 giây**. CLS khoảng 0,00002. Tổng resource transfer mỗi lần khoảng 648KB. JS trả 361.175 byte, CSS 31.341 byte, không có `Content-Encoding` dù request chấp nhận gzip/br. JS/CSS/fonts/hero được thử không có `Cache-Control`; có ETag/Last-Modified.

**Proposed, theo thứ tự:** (1) gzip cho JS/CSS ở Nginx; (2) cache dài/immutable cho asset có hash và policy revalidate cho HTML; ảnh/font URL cố định phải có chiến lược version/invalidations; (3) lazy route Admin/Profile/Orders để Home không tải mọi page; (4) phân tích 9 font resource và unicode-range trước tối ưu, preload có chọn lọc; (5) ưu tiên hero LCP nếu đo lại xác nhận cần. Không tự cài module Brotli/CDN hay đổi stack.

**DoD:** Lặp tối thiểu 3 cold load cùng cấu hình, mục tiêu lab LCP ≤2,5 giây và CLS <0,1, sau đó theo dõi p75 người dùng thực khi có dữ liệu. [LCP guidance](https://web.dev/articles/lcp) phân biệt ngưỡng tốt và đánh giá thực địa. Có bằng chứng response nén/cache; HTML vẫn nhận bản mới; test đăng nhập không bị cache nhầm. Thay đổi production đi qua quy trình triển khai đã chấp thuận.

### F12 — P2: trạng thái lỗi và điều hướng chưa nhất quán

**Observed:** Catalog lỗi có Retry, nhưng Home API lỗi hiện “Đang cập nhật…” và không có Retry. Catalog khi lỗi còn summary “Đang tải…” dù spinner đã hết. Sản phẩm ID không tồn tại vẫn có nút thử lại cho lỗi 404 và title mặc định. Link đăng nhập để review không truyền returnTo, trong khi Login source mặc định tới `/products`.

**Proposed:** Phân biệt loading/empty/offline/not-found; Home có thông báo nhẹ và Retry; 404 detail có title đúng và đường quay lại thay vì retry vô hạn; giữ returnTo nội bộ từ detail, orders/profile/cart khi phù hợp. Không đưa mã kỹ thuật lab vào các luồng mua sắm thông thường.

**DoD:** API lỗi → Retry → phục hồi; empty không hiện như mất mạng; 404 không giả dạng lỗi tạm thời; sau login thành công trong môi trường test quay về đúng ngữ cảnh.

### F13 — P1: mobile cần 2 sản phẩm mỗi hàng và card gọn hơn

**Observed:** CSS hiện dùng 1 cột cho viewport dưới 540px. Ảnh chiếm gần toàn bộ chiều rộng màn hình, khiến mỗi card quá cao và catalog mobile 390px dài khoảng 7.200px. Ảnh chụp người dùng cung cấp cho thấy rõ vấn đề này.

**Planned — yêu cầu trực tiếp của người dùng 2026-10-03:** Home (sản phẩm gợi ý) và Catalog trên mobile **320–767px phải có 2 sản phẩm mỗi hàng**. Thay thế đề xuất trước đó chỉ cân nhắc 2 cột từ 390px; không mặc định giữ 1 cột ở 320px. Đây là yêu cầu cho đợt triển khai tiếp theo, chưa phải giao diện đã sửa.

- Grid 2 cột bằng nhau, cho phép co lại (`repeat(2, minmax(0, 1fr))`); khoảng cách 8–12px và gutter 12–16px tùy độ rộng. Tại 390px, gutter 16px/gap 12px tạo card khoảng 173px; tại 320px, gutter 12px/gap 8px tạo card khoảng 144px.
- Ảnh vuông 1:1 theo chiều rộng card; giảm padding phần thông tin còn khoảng 8–12px. Thu gọn cấu trúc card thay vì chỉ thu nhỏ mọi chữ/nút.
- Tên sản phẩm tối đa 2 dòng, khoảng 14px; giá 14–16px, đầy đủ số tiền. Nhãn danh mục/tồn kho khoảng 12px và sắp xếp để không ép cạnh nhau khi hẹp. Giữ tên đầy đủ trong accessible name/chi tiết sản phẩm.
- Ẩn mô tả dài trên card mobile, giữ mô tả ở trang chi tiết. Đặt giá và nút thêm giỏ ở các hàng riêng; CTA rộng theo card, vùng bấm vẫn cao ít nhất 44px. Các card cùng hàng căn thẳng giá/nút, không vỡ bố cục khi tên dài hoặc hết hàng.
- Giữ grid tablet/laptop/desktop phù hợp các breakpoint hiện có; chỉ thay đổi bố cục card danh sách, trang chi tiết vẫn cần ảnh lớn để xem sản phẩm.

**DoD:** Home và Catalog có đúng 2 cột tại 320/375/390/414px; hai card đầu có cùng vị trí hàng và không tràn ngang. Tên đọc được, giá không bị cắt, CTA chạm dễ; test card có tên dài/giá dài/hết hàng. So sánh ảnh trước/sau để xác nhận thấy được nhiều sản phẩm hơn với cùng chiều cao viewport, đồng thời kiểm tra reflow/zoom 200% và thứ tự đọc trợ năng.

### F14 — P1: dùng catalog đã xác minh và API/database thật, bỏ mock data khỏi luồng nghiệm thu

**Planned — yêu cầu trực tiếp của người dùng 2026-10-03:** Website dùng dữ liệu sản phẩm có nguồn xác minh và dữ liệu nghiệp vụ từ backend/database thật. Các luồng chính phải được kiểm thử xuyên suốt UI → Express API → PostgreSQL, bao gồm đăng nhập, giỏ hàng, tạo/xem/cập nhật/hủy đơn theo quyền hiện có.

**Hiện trạng đã xác minh:** Catalog công khai trong audit đã lấy từ API/database thật. Tuy nhiên, catalog được nhập để demo và audit chưa xác minh tên/đặc tính/ảnh/giá của từng mặt hàng với nguồn sản phẩm. Header tài khoản và checkout success trong một số lượt audit là response mock. Có kết nối database thật không tự chứng minh nội dung sản phẩm là dữ liệu đã kiểm duyệt hoặc toàn bộ nghiệp vụ đã chạy thành công.

- **Chuẩn hóa catalog trước khi làm đẹp card:** Có danh sách sản phẩm đã xác minh tên/model, danh mục, mô tả, thông số và ảnh đúng mặt hàng; ghi nguồn/thời điểm đối chiếu. Giá và tồn kho được quản lý trong database qua backend/admin. Giữ ID/quan hệ hiện có khi cập nhật, tách dòng deployment verification khỏi storefront theo F02.
- **Runtime:** Home/Catalog/Detail/Cart/Orders/Admin lấy dữ liệu từ API tương ứng. Bỏ dữ liệu hard-code, response giả và fallback demo khỏi các luồng sử dụng/nghiệm thu; lỗi API thể hiện trạng thái lỗi/Retry. Trong cart, đọc lại giá/stock từ API để hạn chế dữ liệu snapshot cũ; tổng đơn cuối cùng dùng kết quả server.
- **Đăng nhập và phân quyền thật:** CUSTOMER/ADMIN đăng nhập qua session/CSRF thật; kiểm tra refresh/logout và giỏ từng tài khoản. Tài khoản nghiệm thu phải tồn tại trong database của môi trường kiểm thử, không chỉ được dựng trong response `/api/auth/me`.
- **Đơn hàng thật ở tầng ứng dụng:** Đặt hàng qua `/api/orders` tạo bản ghi thật; đối chiếu tổng server, tồn kho trước/sau, lịch sử và chi tiết đơn. Cập nhật/hủy đơn qua API thật, kiểm tra trạng thái và hoàn stock theo nghiệp vụ. Dùng tài khoản/đơn kiểm thử riêng trong database test; không cần dữ liệu cá nhân của khách hàng thực để chứng minh luồng hoạt động.
- **E2E nghiệm thu:** Thay các response fixture `/api/auth/me`, `/api/products*`, `/api/orders*` bằng backend thật trong bộ nghiệm thu các luồng chính. Chuẩn bị database test bằng migration và import catalog đã kiểm duyệt; ghi dữ liệu kiểm thử bằng API/thiết lập rõ ràng, rồi thu bằng chứng từ API/database. Các ca offline/timeout vẫn có thể ngắt mạng ở trình duyệt vì đó là điều kiện lỗi cần thử, không phải catalog hay đơn giả.
- **Bằng chứng:** Chạy lại header CUSTOMER/ADMIN, Profile, review, checkout guest/customer, Orders/OrderDetail và Admin với hệ thống thật. Lưu kết quả mới theo SHA/môi trường. Giữ nhãn mock của bằng chứng lịch sử để không biến một lượt mô phỏng thành kết quả PASS thật.

**DoD:** Catalog trên UI khớp các bản ghi/nguồn đã kiểm duyệt; mobile 2 cột F13 dùng chính catalog này. Login tạo session thật; checkout trả ID đơn tồn tại trong DB, tổng và biến động stock khớp; quyền sở hữu/admin được kiểm tra; trạng thái UI khớp sau refresh. Bộ nghiệm thu không dùng response mock cho các endpoint chính, và kết quả có ghi môi trường/SHA cùng bằng chứng API/database. Chỉ báo hoàn tất luồng khi kiểm chứng được những điều này.

## Kế hoạch nâng chất lượng giao diện

Giữ KEVILO, Be Vietnam Pro, màu Accepted, React/TypeScript/Vite/CSS thuần và `/api/`. Sau các lỗi trên, **Proposed** polish:

- Home mobile: giảm chiều dài khối danh mục, cân đối tiêu đề “Gợi ý…” và “Xem tất cả” để CTA không vỡ dòng; ưu tiên sản phẩm xuất hiện sớm hơn. Giữ khoảng trắng có chủ đích, không ép toàn bộ 10 card vào màn hình đầu.
- Home/Catalog mobile: triển khai grid **2 sản phẩm mỗi hàng** và card gọn theo yêu cầu **Planned F13** ở trên; đưa vào đợt A, không để ở mức polish tùy chọn.
- Product detail: có thông số có cấu trúc, tương thích, kích thước/kết nối và phân biệt mô tả thật với minh họa demo. Chỉ thêm chính sách bảo hành/đổi trả có nội dung đã được xác nhận. Không thêm rating, ưu đãi hay cam kết giao hàng giả.
- Checkout: ưu tiên thông tin thiết yếu, giải thích phí/mô hình demo trước CTA; thử thanh tổng/CTA mobile có khoảng tránh bàn phím và safe area, chỉ dùng khi không che field/focus.
- Footer: đường dẫn trợ giúp/giới thiệu demo/chính sách có nội dung thật; giữ disclaimer hiện tại và làm nó xuất hiện đúng lúc ra quyết định đặt hàng.

## Thứ tự triển khai đề xuất

Ước lượng **ngày công**, phụ thuộc review ảnh/backend và chưa phải cam kết lịch.

| Đợt | Công việc | Ước lượng | Đầu ra/điều kiện hoàn tất |
| --- | --- | --- | --- |
| A — P1 | F01–F06/F13 và chuẩn hóa catalog F14: dữ liệu/ảnh có nguồn, visibility, cart mobile, hit area, focus drawer, phản hồi stock, grid mobile 2 sản phẩm/hàng | 2–3 ngày, chưa tính thời gian cung cấp/đối chiếu catalog | Mọi P1 có test tái hiện trước sửa và kết quả PASS sau sửa; ảnh/dữ liệu được review; grid 2 cột dùng catalog thật PASS ở 320/375/390/414px |
| B — Hành trình | F07–F10/F12 và tích hợp F14: reset/filter, forms, error/returnTo, xác nhận guest, auth/order/admin qua backend thật | 2–3 ngày | Keyboard thông suốt; thông báo đúng trạng thái; dữ liệu/đơn/session từ API/database thật; các lượt mock cũ được thay bằng bằng chứng nghiệm thu thật |
| C — Hiệu năng và polish | F11, bố cục Home/Catalog/Detail/Checkout | 1–2 ngày | Nén/cache đúng; 3 cold load so sánh trước/sau; visual review desktop/mobile |
| D — Nghiệm thu | Regression responsive/a11y, auth/order/admin end-to-end với API/PostgreSQL thật theo F14, CI | 1–2 ngày | Evidence latest revision và đối chiếu API/database thật, required CI PASS, human review; Team Leader quyết định merge/deploy |

Có thể tách thành PR nhỏ trong phạm vi #51 hoặc issue follow-up rõ ràng. Không cần dựng lại login/cart/catalog đã có. Các quyết định mới về publish state, lưu xác nhận, email hoặc infrastructure cần được review trước khi coi là Accepted.

## Kiểm thử bắt buộc cho đợt cải thiện

1. Dùng **viewport đã cấu hình hoặc `documentElement.clientWidth`** làm mốc responsive, không chỉ `innerWidth`: trong mobile cart tràn, `innerWidth` đã tăng lên 399 và có thể khiến assertion `scrollWidth <= innerWidth` PASS giả. Cover cả cart có nội dung, drawer, lỗi form, toast và order success; không chỉ Home. Với F13, assert đúng 2 cột trên cả Home/Catalog ở 320/375/390/414px, kiểm tra tọa độ card cùng hàng và giá/CTA không bị cắt.
2. Đợi API render, font và ảnh trong vùng nhìn trước khi chụp/đo. Scroll để kích hoạt lazy image. Một screenshot fullPage chưa scroll có skeleton không đủ kết luận ảnh lỗi.
3. Bổ sung test stock saturation, phần còn lại, debounce/reset race, focus cycle và ARIA error associations; kiểm tra hành vi thay vì chỉ tồn tại text.
4. Axe ở tất cả page/trạng thái đã thay đổi; review `incomplete`, keyboard, screen reader, reduced motion, zoom 200%, mobile landscape. Thử trình duyệt khác/thiết bị thật trước nghiệm thu responsive.
5. Theo F14, Auth hợp lệ/logout/session isolation, Profile, review, checkout guest/customer, Orders/OrderDetail, Cancel dialog và Admin chạy với backend/PostgreSQL thật, catalog đã kiểm duyệt và tài khoản/đơn kiểm thử riêng trong DB test. Loại response mock khỏi bộ nghiệm thu các luồng chính; đối chiếu ID đơn, tổng, stock và trạng thái với API/database. Không chạy bộ integration có ghi dữ liệu vào production.
6. Backend integration/baseline theo [README website](../../website/README.md), CI/review theo [Development](../../wiki/DEVELOPMENT.md). Agent không tick human review, merge hay đóng issue từ báo cáo audit.

## Giới hạn còn lại

Chưa kiểm thử đăng nhập thành công bằng tài khoản thật, CRUD admin, đổi mật khẩu, viết review, tạo/hủy đơn thật hoặc thanh toán. Chưa kiểm tra Safari/Firefox/thiết bị vật lý và người dùng screen reader. Chưa có đo INP thực địa/Lighthouse score, audit TLS đầy đủ hoặc rà soát bảo mật toàn diện. Không suy kết quả header mô phỏng hay checkout mô phỏng thành các luồng backend PASS.
