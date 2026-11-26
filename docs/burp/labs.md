# Bốn bài đọc HTTP và mã nguồn

Dùng phiên secure trong [hướng dẫn Burp](README.md) và tài khoản giả của môi trường local. Bảng dưới trích kết quả **hồi quy lịch sử** đã ghi trong [ma trận TEST-02](../../evidence/TEST-02/local-20261025/README.md). Khi bảo vệ, trình bày quan sát mới bên cạnh kết quả cũ và ghi rõ revision của từng lượt.

| Bài | Quan sát trong lab vulnerable đã lưu | Quan sát secure đã lưu |
| --- | --- | --- |
| IDOR | Người dùng khác đọc được đơn giả | API trả 403 cho đơn của người khác, chủ đơn vẫn đọc được |
| SQL Injection | Truy vấn trả cả dữ liệu fixture ngoài kết quả tìm kiếm | Cùng đầu vào được xử lý như văn bản, tìm tên sản phẩm hợp lệ vẫn thành công |
| Stored XSS | Sau khi đọc lại review đã lưu, Chromium ghi nhận marker thực thi | Cùng review xuất hiện dưới dạng chữ, marker không chạy |
| Authentication | Những lượt đăng nhập sai tiếp tục nhận 401 | Limiter trả 429 sau ngưỡng, đăng nhập hợp lệ khi còn lượt vẫn hoạt động |

### 1. Ai được xem đơn hàng?

Trong **Đơn hàng**, mở một đơn của chính tài khoản giả đang đăng nhập. Chọn GET chi tiết đơn trong History. Đọc status và kiểm tra mặt hàng trên trang trùng với dữ liệu JSON. Danh tính người đang yêu cầu đến từ phiên đăng nhập. ID trong đường dẫn chỉ định đơn cần đọc.

Theo dõi từ [OrderDetailPage](../../website/frontend/src/pages/OrderDetailPage.tsx) đến [getOrderById](../../website/backend/src/services/order-service.ts). Với khách hàng thông thường, truy vấn secure ràng buộc cả ID đơn và ID người dùng. Nhánh lab thiếu ràng buộc chủ sở hữu. Trong bản secure, đơn tồn tại nhưng bị từ chối trả 403, đơn không tồn tại trả 404.

**Câu hỏi bảo vệ.** Vì sao ẩn nút xem đơn trong React chưa bảo vệ được dữ liệu? Chỉ ra nơi backend đối chiếu chủ đơn trước khi trả chi tiết.

### 2. Tìm kiếm được chuyển thành truy vấn như thế nào?

Dùng hai kết quả **Comparer** của bài danh mục. Đọc tham số tìm kiếm trên request và tìm tên sản phẩm trong response có kết quả. Theo dõi từ [ProductsPage](../../website/frontend/src/pages/ProductsPage.tsx) đến [listProducts](../../website/backend/src/services/product-service.ts). Nhánh secure đưa chuỗi tìm kiếm vào bộ lọc Prisma `contains`. Trong cùng file, `listProductsWithRawSql` ghép văn bản đầu vào vào câu SQL, khiến cơ sở dữ liệu có thể diễn giải một phần dữ liệu thành cú pháp.

**Câu hỏi bảo vệ.** Vì sao HTTP 200 xuất hiện được ở cả hai chế độ? Dùng nội dung trả về và điều kiện lọc dự kiến để giải thích vì sao chỉ nhìn status chưa đủ.

### 3. Review được lưu và hiển thị ra sao?

Với một sản phẩm giả cho phép tài khoản đánh giá, gửi một nhận xét văn bản vô hại, chẳng hạn “Kệ gỗ <mẫu A>”. Trong History, tìm POST review, rồi tải lại trang và xem GET chi tiết sản phẩm. Đối chiếu comment trong JSON với chữ nhìn thấy trên trang. Trong DevTools → Elements, mở phần tử `.review-comment` và kiểm tra dấu ngoặc vẫn thuộc nội dung chữ. Việc tải lại buộc trang đọc dữ liệu đã lưu thay vì chỉ hiện state sau submit.

Theo dõi [addReview và getProductById](../../website/backend/src/services/product-service.ts) đến [ProductDetailPage](../../website/frontend/src/pages/ProductDetailPage.tsx). React hiển thị `r.comment` như text trong nhánh secure. Nhánh lab chuyển comment sang `dangerouslySetInnerHTML`, khiến browser phân tích nó như HTML. Quan sát văn bản ở trên kiểm tra chức năng hợp lệ. Bằng chứng marker của hai chế độ nằm trong [biên bản Chromium lịch sử](../../evidence/TEST-02/pr56-integration-20261026/README.md).

**Câu hỏi bảo vệ.** Cùng giá trị comment trong JSON, vì sao DOM có thể khác? Chỉ ra nơi giá trị đi vào DOM và loại bằng chứng cần lấy từ trình duyệt để kết luận về thực thi.

### 4. Đăng nhập sai khác bị giới hạn ở đâu?

Trong một phiên mới, đăng nhập tài khoản giả hợp lệ bằng [LoginPage](../../website/frontend/src/pages/LoginPage.tsx). Trong History chỉ ghi method, path và status của login, rồi quan sát request đọc phiên khi tải lại trang. Trong bảng kết quả lịch sử, 401 mô tả lần xác thực thất bại, còn 429 cho biết middleware đã giới hạn lưu lượng. Cả hai có thể khiến UI chưa đăng nhập nhưng nguyên nhân khác nhau.

Trong [authRoutes và loginLimiter](../../website/backend/src/routes/auth-routes.ts), limiter đứng trước session store và phép kiểm mật khẩu. Cấu hình secure giới hạn 10 lần trong 15 phút và bỏ qua lần thành công khi tính bộ đếm. Nhánh lab bỏ qua việc gắn login limiter. [Controller đăng nhập](../../website/backend/src/controllers/auth-controller.ts) xử lý lần đăng nhập đi tiếp.

**Câu hỏi bảo vệ.** Limiter đứng trước phép kiểm mật khẩu bảo vệ tài nguyên nào? Vì sao một request bị giới hạn có thể trả 429 trước cả khi ứng dụng biết mật khẩu có đúng hay không?
