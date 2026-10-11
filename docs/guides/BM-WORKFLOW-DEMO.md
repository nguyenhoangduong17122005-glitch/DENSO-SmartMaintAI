# Kịch bản BM lưu database

Chạy `Chay-demo.cmd`, mở `http://127.0.0.1:8001/`, nhấn Ctrl + F5 sau cập nhật. Đây là dữ liệu thử nghiệm, không phải hướng dẫn sửa máy thực tế.

1. Chọn **Người bảo trì — Nguyễn Minh** → **Hồ sơ công việc** → **Mở công việc BM**.
   - Tên: `DEMO-BM03: Phối hợp kiểm tra rung CNC`.
   - Lý do mở độc lập: `Kiểm tra luồng BM và lưu database`.
   - Hiện tượng: `CNC-04 rung tăng sau thay dao; chưa xác định nguyên nhân. Dữ liệu mô phỏng.`
   - Xác nhận đúng máy demo và bấm tạo. Ghi lại mã hồ sơ.
2. Trong hồ sơ, **Bắt đầu đợt tiếp theo**, thêm ghi nhận hiện tượng của Nguyễn Minh. Mở **Gửi yêu cầu hỗ trợ**, chọn Trần Văn Hải, nhập `Nhờ đối chiếu nhật ký và xác minh nguồn rung` và gửi.
3. Đổi sang **Chuyên gia — Trần Văn Hải** bằng menu tài khoản. Mở **Hỗ trợ & xác nhận** hoặc **Tổng quan**, bấm **Nhận hỗ trợ**. Trước khi nhận lời mời, chuyên gia chưa được đọc nhật ký của hồ sơ mới. Từ chối lời mời không cấp quyền hồ sơ.
4. Mở hồ sơ vừa nhận, thêm ghi nhận do Trần Văn Hải thực hiện: `Đã đối chiếu tình trạng lắp dao theo dữ liệu thử nghiệm`; kết quả `Cần chạy thử và theo dõi thêm`. Ở **Xác nhận phần mình thực hiện**, chọn các ghi nhận của Hải và xác nhận.
5. Đổi lại Nguyễn Minh, mở đúng hồ sơ. **Kết thúc đợt và bàn giao**:
   - Tóm tắt: `Đã kiểm tra và đối chiếu nhật ký cùng chuyên gia`.
   - Việc còn lại: `Theo dõi ở ca tiếp theo`.
6. Ở **Kết thúc công việc BM**, chọn **Đã phục hồi**, nhập kết quả kiểm chứng `Chạy thử demo ổn định; chưa có số đo thực tế` rồi kết thúc. Nhật ký được khóa sửa; trạng thái máy và trạng thái công việc được lưu riêng.
7. Ở **Lập báo cáo**, nhập:
   - Tóm tắt: `Rung sau thay dao, đã kiểm tra cùng chuyên gia`.
   - Nguyên nhân: `Chưa đủ bằng chứng xác định nguyên nhân gốc`.
   - Trạng thái nguyên nhân: **Chưa rõ**.
   - Biện pháp: `Đối chiếu nhật ký, kiểm tra lắp dao theo tình huống mô phỏng`.
   - Kết quả: `Chạy thử demo ổn định`.
   - Theo dõi: `Theo dõi tình trạng rung ở ca sau`.
   - Bấm **Lưu bản nháp** nếu muốn kiểm tra lưu trước; sau đó **Lưu và gửi xác nhận**. Mỗi lần lưu tạo phiên bản mới, không ghi đè lịch sử.
8. Đọc lại báo cáo, tích xác nhận đã đối chiếu rồi bấm **Xác nhận báo cáo**. Đây là xác nhận của người bảo trì phụ trách; phê duyệt tri thức của chuyên gia trưởng thuộc bước tiếp theo.
9. Tải lại trang, mở lại mã hồ sơ: **Công việc: Đã kết thúc**, **Máy: Đã phục hồi**, **Báo cáo: Đã xác nhận**. Xem **các phiên bản báo cáo** để đối chiếu.

Nếu chuyên gia xác nhận sau khi báo cáo đã được lập, nguồn hồ sơ có revision mới: Nguyễn Minh cần **Lưu và gửi xác nhận** lại báo cáo để chụp nguồn mới. Báo cáo không thể xác nhận khi còn đóng góp chuyên gia chưa xác nhận. Nguyên nhân chọn **Đã xác nhận** bắt buộc có nội dung bằng chứng.

Trong SQLite Viewer, mở `.runtime/smartmaint.sqlite3`. Lọc mã hồ sơ ở các bảng `cases`, `case_participants`, `case_rounds`, `case_events`, `support_requests`, `case_closures`, `reports`. Lấy `reports.id` để xem `report_versions` và `report_confirmations`. Dữ liệu RAG và HozenDX vẫn tách biệt; báo cáo xác nhận chưa tự trở thành tri thức đã duyệt hoặc nguồn RAG.
