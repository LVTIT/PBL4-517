# Teach-back — Issue #61 / PR #62

Tài liệu chuẩn bị; chưa xác nhận ba thành viên đã hiểu hoặc đã demo.

1. **Vì sao `if (stock >= quantity)` rồi decrement vẫn race?** Hai dòng gần
   nhau trong source vẫn là hai thời điểm ở database. A và B cùng đọc stock=1,
   cùng qua if; khi B ghi thì giá trị đọc của B đã cũ. Transaction chứa riêng
   decrement không bảo vệ lần đọc ngoài nó.

2. **Vì sao CHECK không đủ?** CHECK ngăn stock âm, nhưng request thua đâm vào
   constraint. Service hiện tại bọc lỗi đó thành 503, khiến người mua tưởng
   database bị sự cố. CHECK là lớp chặn dữ liệu cuối; hết hàng phải được xử lý
   thành kết quả nghiệp vụ 400 OUT_OF_STOCK.

3. **Conditional update khác ở đâu?** `UPDATE Product SET stock=stock-q WHERE
   id=X AND stock>=q` kiểm điều kiện trong cùng lệnh ghi. Ở PostgreSQL read
   committed, request chờ row lock kiểm lại WHERE trên bản mới sau khi winner
   commit. Đủ hàng thì cập nhật một dòng; không đủ thì count=0, service throw
   OUT_OF_STOCK và transaction rollback.

4. **Vì sao claim status trước hoàn kho?** `PENDING -> CANCELLED WHERE
   status=PENDING` là quyền thực hiện cancellation. Chỉ count=1 mới được cộng
   kho. Cộng trước thì loser đã gây tác dụng phụ trước khi biết quyền thao tác.
   Claim và hoàn kho cùng transaction: nếu hoàn kho lỗi, status cũng rollback.

5. **Vì sao hai await tuần tự không chứng minh race?** Request sau chỉ bắt đầu
   khi request trước xong, nên đọc CANCELLED và bị từ chối cả với code cũ. Test
   mới gửi đồng thời và quan sát cả hai API write đang chờ lock trước khi nhả;
   negative control B thực sự tạo stock=12.

6. **Transaction giúp gì với nhiều sản phẩm?** A trừ được, B hết hàng -> throw
   AppError -> rollback toàn transaction. Kho A về giá trị cũ; không có Order
   hay OrderItem dang dở. Test xác nhận A thực sự đã giữ write lock trước khi
   B fail, nên không chỉ kiểm tình huống reject sớm trước mọi decrement.

7. **Bỏ userId khỏi claim có rủi ro gì?** Quyền sở hữu chỉ ở pre-read sẽ không
   được database thực thi lúc đổi status. Refactor hoặc dữ liệu đổi giữa
   read/write có thể biến kiểm quyền thành TOCTOU, tác động đơn ngoài phạm vi.
   Baseline mang userId vào authoritative write; admin và lab IDOR chỉ bỏ
   scope theo nhánh đã có. Lifecycle xác nhận lab vẫn hoạt động có kiểm soát.

8. **Business concurrency error khác database infrastructure error thế nào?**
   Hai khách mua món cuối: database khỏe, một người thắng, người còn lại hết
   hàng -> 400 OUT_OF_STOCK. Hai cancel: loser -> 400 CANNOT_CANCEL. Database
   mất kết nối là ví dụ 503. Phân loại đúng giúp UI/monitoring xử lý đúng nguyên
   nhân. Global Prisma error mapping của #63 vẫn ngoài phạm vi task này.

Demo cho hai thành viên: vẽ timeline A/B; mở hai negative-control log riêng;
đối chiếu UPDATE có WHERE với UPDATE cũ; mở final regression để chỉ stock/order
counts, ba vòng cancel, duplicate lines và rollback. Nhờ mỗi người tự giải thích
winner/loser và dự đoán stock trước khi xem kết quả. Chỉ human xác nhận phần
hiểu/demo đã hoàn thành; agent không tick thay.
