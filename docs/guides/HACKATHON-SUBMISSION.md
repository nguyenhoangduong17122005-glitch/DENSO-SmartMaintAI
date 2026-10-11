# Hướng dẫn xem bản nộp DENSO SmartMaintAI

Bản demo hackathon — cập nhật ngày **12/10/2026**.

**[Mở Live Demo](https://denso-smartmaint-demo.onrender.com/)** · **[Mã nguồn](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI)** · **[README: kiến trúc, sơ đồ và ảnh kết quả](../../README.md)**

## Xem nhanh trong 3 phút

1. Mở Live Demo, chọn **Người bảo trì — Nguyễn Minh** → **Vào bản demo**. Không cần mật khẩu. Nếu máy chủ đang nghỉ, chờ khởi động rồi tải lại.
2. Mở **Tổng quan** và **Ca bảo trì** để xem dữ liệu từ máy chủ. Mở một ca: có bốn tab **Bối cảnh & máy**, **Tra cứu & căn cứ**, **Xử lý & nhật ký**, **Báo cáo tổng kết**.
3. Mở **Bài học từ ca**, đọc mẫu `[DEMO] Ghi nhận rung sau thay dao` và mở phần đối chiếu báo cáo đã xác nhận. Ba bài học mẫu có tác giả, phiên bản, báo cáo nguồn và quyết định duyệt mô phỏng.
4. Mở **Kho tri thức**, tìm `Alarm`, đọc `[DEMO] Ghi nhận nhiệt độ tăng kèm Alarm`. Nội dung có điều kiện áp dụng, bằng chứng và giới hạn; có thể kiểm tra mã `KN-DEMO-CNC-002`.
5. Mở một ca CNC → **Tra cứu & căn cứ**, hỏi `rung sau thay dao`, bấm **Trả lời từ nguồn** và mở citation để đối chiếu. Chế độ mặc định là từ khóa/trả lời mẫu; Gemini và vector là tùy chọn.

Muốn trình diễn toàn bộ quá trình tạo tri thức mới: làm [kịch bản BM](BM-WORKFLOW-DEMO.md) rồi [đề xuất → duyệt → xuất bản → RAG](KNOWLEDGE-RAG-DEMO.md). Chuyên gia dùng **Trần Văn Hải**, người duyệt độc lập dùng **Lê Quốc Anh**.

## Tự chạy bằng Docker

Giải nén gói nộp, mở Terminal tại thư mục chứa `compose.yaml`:

```bash
docker compose up --build -d
docker compose ps
```

Mở **http://127.0.0.1:8001/**. Docker cần đang chạy và có Internet để tải image/thư viện lần đầu. Bản mới không cần API key; tự tạo schema, 5 tài khoản, 8 hồ sơ, trong đó có 3 cặp bài học/tri thức mẫu. Database lưu trong volume `smartmaint-data`.

```bash
docker compose logs --tail=80 smartmaint
docker compose down
```

Lệnh dừng trên giữ database. Khi chạy lại, dữ liệu đã lưu còn nguyên. Trên Windows không dùng Docker: cài Python 3.14 → chạy `Cai-dat-demo.cmd` → `Chay-demo.cmd`.

## Kiểm tra dữ liệu được lưu

Tạo ca có tên riêng, ghi lại mã BM, tải lại trang rồi mở lại mã đó. Với bản local, khởi động lại máy chủ/container rồi kiểm tra tiếp. Live Demo dùng Turso chung theo quyền; Python local và Docker có database riêng, không tự đồng bộ lên website.

## Nội dung và phạm vi bản nộp

- Mã frontend/backend, migration, dữ liệu mô phỏng và kiểm thử.
- README có kiến trúc, sơ đồ luồng dữ liệu, ảnh giao diện mới và cách chạy Docker/Python.
- Hướng dẫn thao tác, dữ liệu mẫu, cấu hình Gemini/vector tùy chọn và hosting.
- Kết quả kiểm tra: **178 tests đạt**, **10/10 câu hỏi demo đạt**, browser smoke giao diện mới đạt. Đây là kiểm tra chức năng; không phải benchmark chất lượng AI hoặc kiểm chứng vận hành nhà máy.
- Bản ZIP được giải nén sang thư mục sạch để kiểm tra thiết lập, tài nguyên frontend, dữ liệu mẫu, tạo ca và giữ dữ liệu sau khởi động lại.

Gói mã nguồn không kèm `.env`, API key/token, database cá nhân, môi trường Python hoặc cache. Database được tạo từ fixtures khi chạy. Toàn bộ dữ liệu CNC/HozenDX là mô phỏng; tài khoản chọn vai trò dùng chung phục vụ demo. PM/thông báo, SSO, AI soạn báo cáo và tích hợp HozenDX thật chưa hoàn chỉnh. [Đối chiếu sơ đồ và giới hạn](../design/WORKFLOW-CONFORMANCE.md).
