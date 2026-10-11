# Từ báo cáo đã xác nhận đến nguồn RAG

Chạy `Chay-demo.cmd`, mở `http://127.0.0.1:8001/` và Ctrl + F5. Hoàn thành [kịch bản BM](BM-WORKFLOW-DEMO.md) trước; hồ sơ cần có báo cáo **Đã xác nhận** trong database.

1. **Nguyễn Minh** mở **Ca bảo trì**, chọn hồ sơ → tab **Báo cáo tổng kết** → **Đưa kinh nghiệm vào kho tri thức**. Nhập tiêu đề `DEMO-RAG-KT04: Rung CNC sau thay dao`, lý do `Lưu kinh nghiệm xử lý và giới hạn áp dụng`, rồi **Tạo đề xuất từ báo cáo**. Hệ thống mở bản nháp lấy nội dung từ đúng phiên bản báo cáo đã xác nhận. Có thể mở lại đề xuất từ menu **Bài học từ ca**.
2. Đọc và chỉnh nội dung: hiện tượng, điều kiện áp dụng, nguyên nhân và trạng thái xác nhận, biện pháp, kết quả, bằng chứng, theo dõi, giới hạn. Giữ trạng thái **Chưa rõ** nếu chưa đủ bằng chứng nguyên nhân. Nhập từ khóa `DEMO-RAG-KT04, rung sau thay dao` để dễ kiểm tra tìm kiếm. Tối đa 12 từ khóa, mỗi từ khóa tối đa 80 ký tự.
3. **Lưu nháp** rồi tải lại để kiểm tra lưu, hoặc **Gửi kiểm duyệt**. Mỗi lần lưu tạo phiên bản mới. Đề xuất chờ duyệt chưa là nguồn RAG.
4. Đổi sang **Chuyên gia trưởng — Lê Quốc Anh**, mở **Kiểm duyệt tri thức**, mở đúng đề xuất. Đọc nội dung và mở **Đối chiếu báo cáo đã xác nhận**. Người duyệt phải có quyền trên máy và độc lập với tác giả/người đóng góp nguồn.
5. Nhập nhận xét, ví dụ `Đã đối chiếu báo cáo, bằng chứng và giới hạn của dữ liệu demo`, tích xác nhận đã đối chiếu. Có ba lựa chọn:
   - **Yêu cầu bổ sung:** Minh sửa theo nhận xét và gửi phiên bản mới; Anh duyệt lại đúng bản mới.
   - **Từ chối:** không tạo tri thức, không xuất hiện trong RAG.
   - **Duyệt & đưa vào RAG:** lưu quyết định duyệt, tạo tri thức, lập chỉ mục rồi xuất bản.
6. Khi bật vector, bước xuất bản gọi Gemini Embedding và cập nhật `.runtime/rag-vectors.sqlite3`. Chờ xử lý hoàn tất trước khi đổi vai trò. Nếu lỗi key/kết nối/hạn mức, nội dung vẫn **Đã duyệt** nhưng chưa xuất bản. Dùng **Đưa vào RAG / thử lại** sau khi khắc phục. Không cần duyệt lại hoặc tạo đề xuất trùng.
7. Mở **Kho tri thức** để đọc bản đã xuất bản và mã `KN-...`, phiên bản, báo cáo nguồn. Tải lại trang để kiểm tra dữ liệu còn nguyên.
8. Đổi lại **Nguyễn Minh**, mở hồ sơ CNC-04 → tab **Tra cứu & căn cứ**. Nếu dùng từ khóa, nhập `DEMO-RAG-KT04` để kiểm tra đúng nguồn. Nếu dùng vector, nhập câu đầy đủ, ví dụ `Case DEMO-RAG-KT04 rung CNC sau thay dao đã ghi nhận biện pháp và giới hạn gì?`; kết quả phụ thuộc mức tương đồng, có thể cần mô tả rõ hơn.
9. Bấm **Trả lời từ nguồn**, kiểm tra nhãn Gemini/từ khóa dự phòng và mã trích dẫn `KN-...@1#...`. Bấm nguồn để đọc toàn văn, bao gồm giới hạn áp dụng. Kết quả của case nguồn không tự xác nhận nguyên nhân của hồ sơ đang tra cứu.

SQLite lưu toàn bộ bản đề xuất, quyết định duyệt, nội dung tri thức và trạng thái xuất bản. `knowledge.active_version` chỉ được đặt khi xuất bản thành công. RAG chỉ lấy bản active, trạng thái ready và valid, đúng phạm vi máy/model. Bản đã xuất bản không sửa trực tiếp; cập nhật hoặc rút bản đã xuất bản nằm ngoài phạm vi bước demo này.

API và nguồn chính: `backend/knowledge.py`, `backend/rag/search.py`, `backend/rag/vectors.py`, `backend/rag/answers.py`; màn hình: `frontend/prototype/knowledge-api.js`. Các lệnh lập chỉ mục cũng đọc tri thức đã xuất bản từ SQLite.
