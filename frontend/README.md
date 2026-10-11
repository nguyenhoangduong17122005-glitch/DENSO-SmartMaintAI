# Frontend DENSO SmartMaintAI

Giao diện chính mở tại `/` qua FastAPI. Chạy `Chay-demo.cmd` từ gốc dự án hoặc `docker compose up --build -d`; mở `http://127.0.0.1:8001/`. Các màn hình dùng API cần máy chủ đang chạy.

Thiết kế tham chiếu: [website Netlify](https://densosmartmaintai.netlify.app/) và [Hoafng3107/Denso_SmartmaintAI](https://github.com/Hoafng3107/Denso_SmartmaintAI), bản `87e755a`. Tổng quan, thẻ ca, thẻ máy và kho tri thức được nối với dữ liệu máy chủ của dự án này.

Giao diện hiện dùng nền sáng, điểm nhấn đỏ DENSO và font Plus Jakarta Sans cục bộ. Người bảo trì có các mục **Tổng quan**, **Ca bảo trì**, **Kho tri thức**, **Bài học từ ca**. Menu chuyên gia có **Hỗ trợ hiện trường**, **Hồ sơ tham gia**, **Tri thức của tôi**; chuyên gia trưởng có **Kiểm duyệt tri thức**. Trên **Bài học từ ca**, tiêu đề phụ “Đề xuất của tôi” đã bỏ; tên các route nội bộ vẫn giữ để tương thích.

Ba bài học/nguồn mẫu được tạo từ `fixtures/cases/cnc-knowledge-samples.json` qua `backend/demo_knowledge.py`, không khai báo thêm vào JavaScript. Chọn Nguyễn Minh để xem ba bài học của tác giả này. [Mã mẫu và cách nạp](../docs/guides/DENSO-DEMO-SAMPLE-DATA.md).

## Sửa file nào?

| File/thư mục | Vai trò |
|---|---|
| `index.html` | Trang chính và thứ tự nạp CSS/JavaScript |
| `assets/js/app.js` | Chọn vai trò, menu, khung trang và điều hướng |
| `assets/css/styles.css` | Thiết kế nền từ giao diện mẫu |
| `assets/css/theme-compat.css` | Điều chỉnh thiết kế cho các màn hình dùng API |
| `assets/css/fonts.css`, `assets/fonts/` | Plus Jakarta Sans cục bộ và giấy phép |
| `assets/images/` | Logo, favicon và nền trang chọn vai trò |
| `prototype/visual-templates.js` | Mẫu hiển thị tổng quan, ca, máy, tiêu đề bốn giai đoạn và kho tri thức; không ghi dữ liệu |
| `prototype/backend.js` | Phiên API, danh sách/lọc ca, tạo ca và nhập hồ sơ trình duyệt cũ |
| `prototype/database-views.js` | Đọc tổng quan, hỗ trợ và dữ liệu HozenDX qua API |
| `prototype/knowledge-api.js` | Kho tri thức, đề xuất, kiểm duyệt, xuất bản và tìm theo từ khóa trong kho |
| `prototype/demo-guide.js` | Hướng dẫn thao tác theo vai trò |
| `workspace/workspace.js` | Đọc/lưu bối cảnh, nhật ký, hỗ trợ, báo cáo và gọi RAG; tổ chức chi tiết ca thành bốn tab |
| `workspace/workspace.css` | Kiểu cho các biểu mẫu API và trang workspace độc lập |

`prototype/` là tên thư mục lịch sử. `core.js`, `data.js`, `cases.js` và `knowledge.js` vẫn cung cấp tiện ích, tài khoản/máy mô phỏng và phần tương thích với hồ sơ lưu trên trình duyệt. `presentation.js` và `presentation-engine.js` phục vụ phần trình diễn còn được nạp. Giữ các file này khi cập nhật giao diện.

## Thứ tự nạp và lưu dữ liệu

`index.html` nạp tiện ích/dữ liệu trước, sau đó khung trang và workspace, rồi mẫu hiển thị và các adapter API. Các adapter thay trang prototype bằng trang dùng máy chủ. Không thay toàn bộ JavaScript bằng bản Netlify: bản mẫu sử dụng localStorage, còn bản này lưu nghiệp vụ qua API.

Chi tiết ca có bốn tab **Bối cảnh & máy**, **Tra cứu & căn cứ**, **Xử lý & nhật ký**, **Báo cáo tổng kết**. Chuyển tab giữ các phần tử biểu mẫu để giữ nội dung đang nhập; người dùng phải bấm lưu để ghi vào database.

Backend chỉ phục vụ các file đã cho phép trong `backend/main.py`. Khi thêm một file frontend, cập nhật HTML và route/allowlist tương ứng. `/workspace` là giao diện API độc lập phục vụ chẩn đoán và khôi phục phiên; giao diện trình diễn chính là `/`.

## Kiểm tra sau khi sửa

Tại thư mục gốc, sau khi cài `backend/requirements-dev.txt`:

```powershell
py -m backend.tools.browser_smoke --original-ui
py -m pytest backend/tests/test_api.py::test_original_shell_and_workspace_routes backend/tests/test_hosting.py -q
```

Browser smoke dùng database/profile thử nghiệm riêng; kiểm tra cả lưu dữ liệu, bốn tab, màn hình điện thoại, báo cáo, duyệt tri thức và RAG. Thêm `--docs-screenshots` để cập nhật ảnh README. Xem [cấu trúc dự án](../docs/PROJECT-STRUCTURE.md) và [kịch bản BM](../docs/guides/BM-WORKFLOW-DEMO.md).
