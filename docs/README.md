# Tài liệu và dữ liệu

Xem [cấu trúc dự án và vị trí các file](PROJECT-STRUCTURE.md) để tìm nhanh phần cần sửa/chạy.

## Dùng bản demo hiện tại

| Tài liệu | Nội dung |
|---|---|
| [Live Demo và Docker](guides/LIVE-DEMO-DEPLOYMENT.md) | Cấu hình triển khai, ổ dữ liệu và cách xác minh link demo |
| [Bàn giao](guides/DEMO-HANDOVER.md) | Chức năng đã có, kết quả kiểm tra và giới hạn |
| [Kịch bản BM](guides/BM-WORKFLOW-DEMO.md) | Điền dữ liệu, phối hợp chuyên gia và xác nhận báo cáo |
| [Tri thức/RAG](guides/KNOWLEDGE-RAG-DEMO.md) | Đề xuất, duyệt, xuất bản và kiểm tra trích dẫn |
| [Gemini/vector](guides/DENSO-RAG-VECTOR-GEMINI.md) | Cấu hình key và kiểm tra provider thật |
| [Dữ liệu mẫu](guides/DENSO-DEMO-SAMPLE-DATA.md) | Hồ sơ CNC và câu hỏi demo |
| [Chia sẻ GitHub](guides/GITHUB-SHARING.md) | Những file đưa lên repo và cài trên máy người nhận |

`design/` chứa thiết kế RAG, phạm vi MVP, mô hình dữ liệu, kiểm kê nguồn và chuẩn bị tích hợp HozenDX. Đây là tài liệu kỹ thuật; các yêu cầu pilot/production chưa được triển khai đầy đủ.

`history/` chứa kế hoạch và kết quả các bước trước. Các câu “chưa có Gemini” hoặc “chưa có báo cáo/duyệt” trong đó mô tả thời điểm cũ. Tình trạng mới nhất nằm trong tài liệu bàn giao.

## Dữ liệu nào nằm ở đâu?

| Thư mục/file | Vai trò |
|---|---|
| [Mẫu nguồn thật](data/templates/CNC-REAL-SOURCES-TEMPLATE.csv) | CSV chỉ có header, cố ý để trống cho lần thu thập sau |
| [Kiểm kê CNC](data/inventory/CNC-SOURCE-INVENTORY.csv) | 7 đối tượng demo được kiểm kê ban đầu; không phải corpus RAG đầy đủ hiện tại |
| [Xác minh HozenDX](data/inventory/HOZENDX-VERIFICATION.csv) | Câu hỏi và thông tin đã/chưa xác minh |
| `fixtures/cases/` | JSON hồ sơ mẫu để khởi tạo SQLite |
| `fixtures/hozendx/` | Adapter mock đọc thông tin thiết bị |
| `fixtures/rag/` | Tài liệu/câu hỏi mô phỏng phục vụ RAG và kiểm tra |
| `.runtime/smartmaint.sqlite3` | Database đang dùng, giữ nguyên vị trí |
| `.runtime/rag-vectors.sqlite3` | Chỉ mục vector đang dùng, giữ nguyên vị trí |
| `.runtime/reports/` | Kết quả kiểm tra và bản ghi sắp xếp file, không đưa lên GitHub |

Các bản sao lưu migration giữ nguyên cạnh database vì đường dẫn đã được ghi trong `schema_migrations`. Không xóa hoặc chuyển chúng như cache.

Xem [kiểm kê từng file](FILE-INVENTORY.md) để biết lý do giữ và phân loại file. Mã kiểm thử, migration, font/giấy phép và các module prototype đang được nạp đều được giữ lại.
