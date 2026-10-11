# Cấu trúc dự án

## Mở file nào để làm gì?

| Bạn muốn | File/thư mục |
|---|---|
| Cài lần đầu trên Windows | `Cai-dat-demo.cmd` ở thư mục gốc |
| Chạy demo | `Chay-demo.cmd` ở thư mục gốc |
| Đổi màu sắc, bố cục | `frontend/assets/css/styles.css`, `theme-compat.css` |
| Đổi ảnh/logo, font | `frontend/assets/images/`, `frontend/assets/fonts/` |
| Sửa màn hình nghiệp vụ | `frontend/prototype/` (tên lịch sử; các module vẫn được sử dụng) |
| Sửa mẫu giao diện Netlify | `frontend/prototype/visual-templates.js` |
| Sửa chi tiết ca và bốn tab | `frontend/workspace/workspace.js`, `workspace.css` |
| Xem thứ tự nạp và vai trò từng module frontend | [Hướng dẫn frontend](../frontend/README.md) |
| Sửa API/luồng BM | `backend/main.py`, `journal.py`, `workflow.py` |
| Sửa duyệt/xuất bản tri thức | `backend/knowledge.py` |
| Sửa tìm kiếm/trả lời | `backend/rag/` |
| Sửa kết nối database | `backend/store.py`, `remote_store.py` |
| Sửa dữ liệu mô phỏng | `fixtures/cases/`, `fixtures/hozendx/`, `fixtures/rag/` |
| Sửa 3 bài học/tri thức mẫu | `fixtures/cases/cnc-knowledge-samples.json`, `backend/demo_knowledge.py` (không ghi đè mẫu đã tồn tại) |
| Xem database local | `.runtime/smartmaint.sqlite3`, mở bằng SQLite Viewer |
| Đổi cấu hình riêng | `.env` (không đưa lên GitHub) |
| Chạy Docker / Render | `Dockerfile`, `compose.yaml` / `render.yaml` |
| Xem hướng dẫn | `README.md`, `docs/guides/` |

## Công cụ Python

Chạy từ thư mục gốc, dùng Python trong `.venv` nếu đã cài:

```powershell
# Đọc trạng thái database đang được cấu hình
py -m backend.tools.check_storage

# Xuất hồ sơ SQLite local thành HTML dễ đọc
py -m backend.tools.export_cases

# Kiểm tra 10 câu hỏi demo, không gọi Gemini, dùng database tạm
py -m backend.tools.demo_check

# Kiểm tra giao diện Edge với database/profile tạm
py -m backend.tools.browser_smoke --original-ui

# Chạy bộ kiểm thử
py -m pytest backend/tests -q
```

Hai công cụ kiểm tra `demo_check` và `browser_smoke` luôn dùng SQLite tạm riêng, không ghi vào database cloud. Các công cụ kiểm thử cần thư viện trong `backend/requirements-dev.txt`.

Các entry point ứng dụng vẫn là `backend.launch_demo`, `backend.setup_demo`, `backend.serve`. `backend/tools/` chỉ chứa công cụ thao tác thủ công/kiểm tra. `scripts/ci/` dành cho CI; `scripts/windows/` chứa lệnh Gemini/vector tùy chọn.

## Dữ liệu và file sinh tự động

`.runtime/` chứa database, backup, chỉ mục vector, báo cáo, log và dữ liệu kiểm thử. `.env` chứa cấu hình riêng. Hai vị trí này không được đưa lên GitHub. Không chuyển database hay backup đã được migration ghi đường dẫn vào như cache.

`docs/design/` là thiết kế; `docs/guides/` là hướng dẫn dùng hiện tại; `docs/history/` là các bước đã làm trước đây; `docs/data/` là bảng kiểm kê/mẫu thu thập; `docs/assets/` chứa ảnh chụp cho README. Dữ liệu ứng dụng đọc khi chạy nằm ở `fixtures/`.
