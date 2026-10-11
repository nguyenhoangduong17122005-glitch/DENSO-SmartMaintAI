# Dữ liệu mẫu bổ sung cho demo CNC

Toàn bộ dữ liệu tự soạn, không phải hồ sơ DENSO hoặc HozenDX thực tế. Bộ tài liệu tĩnh có 14 tài liệu, 29 mục; 4 hồ sơ đang chờ xử lý có 4 đợt đã kết thúc và 8 ghi nhận. Ngoài ra, có 3 ca mẫu đã kết thúc kèm bài học và tri thức xuất bản được lưu trong database như mô tả bên dưới.

## Cách dùng

### Ba bài học và ba tri thức đã xuất bản

Khi khởi động bằng `Chay-demo.cmd`, Docker hoặc Render, hệ thống bổ sung một lần 3 cặp mẫu dưới đây. Chọn **Người bảo trì — Nguyễn Minh**, mở **Bài học từ ca** để đọc đề xuất/báo cáo nguồn, hoặc **Kho tri thức** để tìm và đọc nguồn đã xuất bản.

| Tình huống mô phỏng | Ca nguồn đã kết thúc | Bài học đã duyệt | Tri thức đã xuất bản |
|---|---|---|---|
| Ghi nhận rung sau thay dao | BM-KNOWLEDGE-001 | DP-DEMO-CNC-001 | KN-DEMO-CNC-001 |
| Ghi nhận nhiệt độ tăng kèm Alarm | BM-KNOWLEDGE-002 | DP-DEMO-CNC-002 | KN-DEMO-CNC-002 |
| Đối chiếu rung sau thay đồ gá | BM-KNOWLEDGE-003 | DP-DEMO-CNC-003 | KN-DEMO-CNC-003 |

Mỗi mẫu có bối cảnh, một đợt với hai ghi nhận, kết thúc công việc, báo cáo đã xác nhận, đề xuất và quyết định duyệt độc lập mô phỏng của `u-anh`. Tác giả là `u-minh` để xuất hiện trong **Bài học từ ca** của Nguyễn Minh. Người có quyền CNC-04 có thể đọc các nguồn trong **Kho tri thức**. Các nội dung đều ghi `[DEMO]`, không có số đo thực tế, không kết luận đã sửa được máy.

Nội dung tại [cnc-knowledge-samples.json](../../fixtures/cases/cnc-knowledge-samples.json), được nạp bởi [demo_knowledge.py](../../backend/demo_knowledge.py). Việc nạp giữ nguyên dữ liệu có sẵn, không đổi mật khẩu/quyền và không tự xuất bản lại nguồn đã bị thu hồi. Không cần Gemini hoặc vector để xem và tra cứu theo từ khóa.

Để thêm vào database đã khởi tạo mà không khởi động lại server:

```powershell
py -m backend.demo_knowledge
```

Lệnh dùng cấu hình lưu trữ hiện tại trong `.env`. Trên Live Demo, mẫu nằm trong Turso dùng chung; database local riêng biệt.

### Bốn hồ sơ đang chờ xử lý

Mở http://127.0.0.1:8001/, chọn Người bảo trì hoặc Chuyên gia, vào hệ thống rồi mở **Ca bảo trì** / **Hồ sơ tham gia**. Nếu đang mở trang, tải lại để cập nhật danh sách. Bốn hồ sơ đang chờ được cấp cho Nguyễn Minh và Trần Văn Hải. Dùng giao diện qua FastAPI để đọc/ghi database; không dùng Live Server ở cổng 5500 cho mục đích này.

| Hồ sơ | Tình huống | Câu hỏi gợi ý | Nguồn |
|---|---|---|---|
| BM-DEMO-001 | Case rung sau thay dao — mô phỏng | Máy CNC rung sau thay dao cần ghi nhận gì? | DEMO-CNC-009 |
| BM-DEMO-002 | Case nhiệt độ tăng kèm Alarm — mô phỏng | Nhiệt độ tăng kèm Alarm cần bổ sung thông tin gì? | DEMO-CNC-010 |
| BM-DEMO-003 | Case rung kèm tiếng ồn — mô phỏng | Rung kèm tiếng ồn cần đối chiếu thông tin gì? | DEMO-CNC-011 |
| BM-DEMO-004 | Case nhiệt độ tăng sau đổi sản phẩm — mô phỏng | Nhiệt độ tăng sau đổi sản phẩm cần ghi nhận gì? | DEMO-CNC-012 |

Hai nguồn bổ sung khác:

- DEMO-CNC-013: mẫu ghi nhận số đo. Hỏi: “Phiếu số đo rung và nhiệt độ cần những trường nào?”
- DEMO-CNC-014: mẫu bàn giao. Hỏi: “Bàn giao sự cố CNC chưa kết luận cần ghi gì?”

Trong từng hồ sơ, dùng **Tra cứu tài liệu** rồi **Trả lời từ nguồn** và mở dẫn chứng. Nhật ký có hai ghi nhận mẫu: hiện tượng của người bảo trì và rà soát của chuyên gia. Bạn có thể bắt đầu đợt tiếp theo để diễn tiếp kịch bản. Thời điểm thực hiện của các ghi nhận mẫu chưa được xác minh nên để trống, không tạo số đo hoặc xác nhận chuyên gia giả.

## Nạp lại trên DB demo khác

Sau init-demo, chạy:

```powershell
py -m backend.manage add-samples
```

Chạy lại bỏ qua ID hồ sơ đã tồn tại; không cập nhật nội dung hồ sơ cũ, mật khẩu hoặc quyền. Tài liệu tra cứu được đọc trực tiếp từ fixtures/rag/cnc-demo-sources.json. Thêm các hồ sơ không tự biến nhật ký thành nguồn tri thức đã phê duyệt. Các hồ sơ tham chiếu cùng snapshot HozenDX mock, không thêm lịch sử giả vào nguồn HozenDX.
