# Script hỗ trợ

Các lệnh thường dùng trên Windows vẫn nằm ở thư mục gốc:

- `Cai-dat-demo.cmd`: cài thư viện và tạo dữ liệu demo.
- `Chay-demo.cmd`: chạy ứng dụng và mở trình duyệt.

## Công cụ tùy chọn

| File | Công dụng |
|---|---|
| `windows/Tao-chi-muc-RAG.cmd` | Tạo embedding và chỉ mục vector; cần Gemini API key |
| `windows/Kiem-tra-RAG.cmd` | Kiểm tra Gemini/embedding/vector thật; sử dụng hạn mức API |
| `ci/docker_smoke.py` | Dành cho GitHub Actions: kiểm tra Docker, API và dữ liệu sau restart |

Hai file trong `windows/` có thể nhấp đúp từ File Explorer. Chúng tự chuyển về thư mục gốc và dùng `.venv` nếu đã cài. Không cần chạy khi dùng `template`/`keyword`.

Công cụ Python kiểm tra/xuất dữ liệu nằm trong [backend/tools](../backend/tools/). Chạy từ thư mục gốc bằng `python -m backend.tools.<tên_công_cụ>`; xem [cấu trúc dự án](../docs/PROJECT-STRUCTURE.md).
