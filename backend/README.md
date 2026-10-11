# Backend DENSO SmartMaintAI

FastAPI phục vụ frontend mới và API cùng origin. Giao diện chính ở `/`; `/workspace` dành cho chẩn đoán và phục hồi phiên. Xem [README dự án](../README.md), [bản đồ frontend](../frontend/README.md) và [bàn giao hiện tại](../docs/guides/DEMO-HANDOVER.md).

## Chạy từ thư mục gốc

Trên Windows, chạy `Cai-dat-demo.cmd` lần đầu, sau đó `Chay-demo.cmd`. Hoặc:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m backend.setup_demo
.\.venv\Scripts\python.exe -m backend.launch_demo
```

Mở **http://127.0.0.1:8001/**, chọn vai trò rồi vào demo. Máy chủ cần chạy trong suốt thời gian sử dụng. Dùng lệnh module ở trên, không chạy `launch_demo.py` như một file rời.

Backend khởi tạo 5 tài khoản và 8 hồ sơ mẫu: 5 hồ sơ ban đầu, 3 ca đã kết thúc kèm bài học/tri thức mô phỏng đã xuất bản. Khởi động lại giữ nguyên hồ sơ, mật khẩu và các mẫu đã có. [Dữ liệu mẫu](../docs/guides/DENSO-DEMO-SAMPLE-DATA.md).

## Giao diện và nghiệp vụ

| Vai trò | Menu chính |
|---|---|
| Người bảo trì — Nguyễn Minh | Tổng quan, Ca bảo trì, Kho tri thức, Bài học từ ca |
| Chuyên gia — Trần Văn Hải | Tổng quan, Hỗ trợ hiện trường, Hồ sơ tham gia, Tri thức của tôi, Kho tri thức |
| Chuyên gia trưởng — Lê Quốc Anh | Tổng quan, Kiểm duyệt tri thức, Kho tri thức |

Chi tiết ca có bốn tab: **Bối cảnh & máy**, **Tra cứu & căn cứ**, **Xử lý & nhật ký**, **Báo cáo tổng kết**. Tổng quan, BM và tri thức dùng API theo quyền. `frontend/prototype/` là tên thư mục lịch sử, chứa các adapter đang dùng. LocalStorage của giao diện tham chiếu không phải database nghiệp vụ của bản này.

Luồng BM: tạo hồ sơ → mở đợt → hỗ trợ/nhật ký/xác nhận đóng góp → kết thúc đợt và công việc → lập/xác nhận báo cáo → đề xuất → duyệt độc lập → xuất bản → tra cứu có nguồn. [Kịch bản BM](../docs/guides/BM-WORKFLOW-DEMO.md) · [Tri thức/RAG](../docs/guides/KNOWLEDGE-RAG-DEMO.md).

## Lưu trữ và cấu hình

- `SMARTMAINT_STORAGE=sqlite`: database Python local mặc định `.runtime/smartmaint.sqlite3`; migration có backup khi cần nâng cấp.
- `SMARTMAINT_STORAGE=turso`: cần `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` riêng phía server; libSQL qua HTTPS dùng chung theo quyền. Không tự đồng bộ SQLite lên Turso, không âm thầm ghi local khi cloud lỗi.
- Docker local mặc định dùng volume `smartmaint-data`; entry point container là `backend.serve`.
- `.env` chứa cấu hình riêng, không đưa lên GitHub. [Hosting Render + Turso](../docs/guides/LIVE-DEMO-DEPLOYMENT.md).

Mặc định **từ khóa + trả lời mẫu**, không cần API key. Gemini/Gemini Embedding/sqlite-vec là tùy chọn; [cách cấu hình và kiểm tra](../docs/guides/DENSO-RAG-VECTOR-GEMINI.md). Vector index là cache có thể tạo lại; báo cáo, đề xuất và tri thức nằm trong database nghiệp vụ.

## Các module

| File/thư mục | Trách nhiệm |
|---|---|
| `main.py`, `security.py`, `hosting.py` | API, phiên/quyền, CSRF, static allowlist và host/origin |
| `store.py`, `remote_store.py`, `migrate.py`, `migrations/` | SQLite/libSQL, migration và backup |
| `domain.py`, `journal.py`, `workflow.py` | Bối cảnh, đợt, nhật ký, hỗ trợ, đóng việc và báo cáo |
| `knowledge.py` | Đề xuất, duyệt độc lập và xuất bản |
| `rag/` | Nguồn khả dụng, truy xuất và trả lời có citation |
| `hozendx.py` | Thiết bị CNC-04 mô phỏng |
| `setup_demo.py`, `launch_demo.py`, `serve.py` | Thiết lập, khởi động local và container |
| `manage.py`, `demo_knowledge.py` | Quản lý dữ liệu mẫu |
| `tools/`, `tests/` | Công cụ kiểm tra/xuất dữ liệu và kiểm thử |

Ghi nghiệp vụ cần đúng phiên, quyền, CSRF và revision; hỗ trợ chống gửi lặp bằng `Idempotency-Key`. Token phiên lưu dưới dạng hash phía server, cookie HttpOnly/SameSite; HTTPS bật Secure. Static routes không phục vụ `.env`, database hoặc mã Python.

## Kiểm tra

```powershell
py -m pip install -r backend/requirements-dev.txt
py -m pytest backend/tests -q
py -m backend.tools.demo_check
py -m backend.tools.browser_smoke --original-ui
```

Kiểm thử dùng SQLite/profile riêng, không ghi vào database cloud. Browser smoke cần Edge và `websocket-client`; `--docs-screenshots` cập nhật ảnh README. `py -m backend.tools.check_storage` đọc trạng thái database đang cấu hình; `export_cases` xuất SQLite local thành HTML.

Bộ chọn vai trò dùng tài khoản chung để trình diễn, chưa phải xác thực production. Có thể tắt bằng `SMARTMAINT_DEMO_ROLE_SELECTION=0`; API đăng nhập mật khẩu vẫn được hỗ trợ. `py -m backend.manage reset-demo-password --username minh` đặt lại mật khẩu và thu hồi phiên cũ; không cần lệnh này khi chỉ đổi vai trò.

PM/thông báo chưa có đầy đủ backend. AI soạn báo cáo, SSO và HozenDX thật chưa được triển khai. [Đối chiếu sơ đồ](../docs/design/WORKFLOW-CONFORMANCE.md) mô tả phạm vi; `docs/history/` lưu các bước cũ.
