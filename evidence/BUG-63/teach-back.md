# Issue #63 implementer teach-back

Đây là câu trả lời của implementer, không phải xác nhận cả nhóm đã hiểu/demo/review.

1. **Invalid UUID vì sao không phải 503?** Request sai định dạng có thể được
   client sửa; DB vẫn có thể hoạt động bình thường. Validate trước DB trả 400.
2. **400/404/409/503?** 400 là input không hợp lệ; 404 là tài nguyên yêu cầu không
   tồn tại; 409 là xung đột với dữ liệu/trạng thái hiện tại; 503 là fallback an
   toàn khi tầng dữ liệu không phục vụ được hoặc chưa phân loại chắc chắn.
3. **Không map mọi Prisma error sang 4xx?** Cùng một lỗi relation/format/check có
   thể xuất phát từ invariant nội bộ hoặc lỗi phần mềm, không phải request.
4. **Unknown code giữ 503?** Không đủ bằng chứng để quy lỗi cho client. Giữ
   fallback hiện hành bảo vệ việc phát hiện sự cố, thay vì đoán 400/409.
5. **AppError passthrough?** Đây là domain decision đã có status/code/message
   an toàn. Trả cùng object giữ identity và không ghi đè quyết định của service.
6. **Bỏ passthrough làm #61 hỏng ở đâu?** Transaction throw OUT_OF_STOCK khi claim
   stock thất bại và CANNOT_CANCEL khi thua claim hủy; blanket catch biến 400
   thành 503. Negative B làm cả bốn #61 tests fail.
7. **#65 hỏng ở đâu?** Invalid edge, terminal replay và thua state claim phải
   409 INVALID_STATUS_TRANSITION; mất passthrough thành 503. B bắt được các case.
8. **Registration race P2002?** Giữ pre-check. Sau failed insert, xác nhận đó là
   known P2002 của User, re-read email; email tồn tại thì 409 EMAIL_EXISTS.
   P2002 khác trả generic 409 CONFLICT; lỗi re-read trả fallback an toàn.
9. **Pre-check chưa đủ?** Hai transaction có thể cùng chưa thấy email trước khi
   insert. Unique constraint mới quyết định winner; catch xử lý loser. Test dùng
   uncommitted winner và quan sát blocked INSERT, không dựa vào timing may rủi.
10. **P2003 vì sao conflict?** Trong ngữ cảnh delete Product đã xác minh, OrderItem
    đang tham chiếu Product nên DB chủ động từ chối thao tác. Kết nối DB vẫn tốt.
    Không map P2003 toàn cục vì lỗi relation trong transaction khác chưa chắc có
    cùng domain meaning.
11. **Unit và HTTP khác nhau?** Unit tạo lỗi kiểm tra mapper và identity nhanh,
    không cần DB. HTTP kiểm tra route validation, auth/CSRF, service catch, lỗi
    Prisma thật và middleware serialization/status/message qua toàn luồng.
12. **PostgreSQL thật?** Constraint, pg adapter metadata, transaction visibility
    và lock/recheck behavior không được chứng minh bằng mock. Prisma 7.10 pg thực
    tế không có meta.target ở probe này; test thật đã phát hiện giả định sai.
13. **Không leak internals?** Constraint/table/driver/SQL/stack/connection details
    không giúp client sửa request và có thể lộ cấu trúc hệ thống/credentials.
    Message là literal/domain message an toàn; test assert toàn JSON envelope.
14. **Script tồn tại chưa chứng minh CI chạy?** Job có thể chưa gọi nó. Required
    backend-integration hiện gọi test:data-errors trực tiếp trong ci.yml rồi
    gọi test:integration (bao gồm file #63) qua backend-integration.sh. Cần log
    hosted run đúng final head để chứng minh thực thi, không chỉ đọc manifest.
15. **#63 so với #61/#65?** #63 phân loại/serialize lỗi ở ranh giới dữ liệu và
    validate ID. #61 bảo vệ atomic stock/customer cancel; #65 bảo vệ state machine
    và admin restock. #63 không sửa thuật toán transaction của hai issue đó.
