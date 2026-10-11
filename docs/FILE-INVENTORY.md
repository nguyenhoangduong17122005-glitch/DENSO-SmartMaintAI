# Kiểm kê file sau khi sắp xếp

## Bổ sung cho README, Docker và Live Demo

| File | Công dụng / lý do giữ |
|---|---|
| `Dockerfile` | Đóng gói frontend/backend và thư viện Python |
| `.dockerignore` | Không đưa key, database, cache hoặc file riêng vào image |
| `compose.yaml` | Chạy local bằng Docker với volume giữ database |
| `render.yaml` | Blueprint triển khai Render tùy chọn; cần xác nhận chi phí |
| `.github/workflows/docker-smoke.yml` | Build và kiểm tra Docker trên GitHub Actions |
| `scripts/docker_smoke.py` | Kiểm tra HTTP, RAG mẫu và hồ sơ qua restart container |
| `backend/serve.py` | Khởi tạo dữ liệu khi cần và chạy server một worker |
| `backend/hosting.py` | Host/origin HTTPS theo cấu hình chính xác |
| `backend/tests/test_hosting.py` | Kiểm tra host, HTTPS, cookie, CSRF và khởi tạo lặp lại |
| `docs/guides/LIVE-DEMO-DEPLOYMENT.md` | Các bước deploy và kiểm tra URL Live Demo |
| `docs/assets/screenshots/role-selection.png` | Ảnh thật màn hình chọn vai trò |
| `docs/assets/screenshots/case-workspace.png` | Ảnh thật hồ sơ CNC |
| `docs/assets/screenshots/rag-answer.png` | Ảnh thật câu trả lời mẫu có citation |
| `docs/assets/screenshots/knowledge-library.png` | Ảnh thật tri thức được duyệt/xuất bản |

Rà soát ngày 11/10/2026. Kiểm tra cấu trúc/tham chiếu và định dạng từng file; không phải cam kết đã review đầy đủ mọi nhánh logic.

`.env` không được đưa nội dung vào báo cáo. Database được mở chỉ đọc. Các bản backup được giữ vì còn dùng để khôi phục.

## Mã nguồn, tài nguyên và tài liệu đưa lên repo

| File | Công dụng / lý do giữ | Kiểm tra |
|---|---|---|
| `.env.example` | Mẫu cấu hình an toàn, không có key | Phân loại/đối chiếu tham chiếu |
| `.gitignore` | Loại cấu hình/database/cache khỏi Git | Phân loại/đối chiếu tham chiếu |
| `.vscode/settings.json` | Cấu hình xem SQLite và ẩn cache trên VS Code | JSON hợp lệ |
| `backend/__init__.py` | Định danh package Python | Python AST hợp lệ |
| `backend/browser_import.py` | Nhập hồ sơ localStorage có kiểm tra | Python AST hợp lệ |
| `backend/browser_smoke.py` | Kiểm tra giao diện trên DB riêng | Python AST hợp lệ |
| `backend/config.py` | Đọc cấu hình riêng | Python AST hợp lệ |
| `backend/demo_check.py` | Kiểm tra bộ câu hỏi mẫu, ghi báo cáo local | Python AST hợp lệ |
| `backend/domain.py` | Chuẩn hóa và phiên bản nghiệp vụ | Python AST hợp lệ |
| `backend/export_cases.py` | Xuất hồ sơ HTML chỉ đọc | Python AST hợp lệ |
| `backend/hozendx.py` | Adapter thiết bị mock | Python AST hợp lệ |
| `backend/journal.py` | Nhật ký, đợt xử lý, xác nhận | Python AST hợp lệ |
| `backend/knowledge.py` | Đề xuất, duyệt và xuất bản tri thức | Python AST hợp lệ |
| `backend/launch_demo.py` | Chạy máy chủ và mở trình duyệt | Python AST hợp lệ |
| `backend/main.py` | FastAPI, phiên/quyền và phục vụ giao diện | Python AST hợp lệ |
| `backend/manage.py` | Khởi tạo/quản lý demo | Python AST hợp lệ |
| `backend/migrate.py` | Migration có backup | Python AST hợp lệ |
| `backend/migrations/002_domain.sql` | Schema/trigger SQL cần để nâng cấp database | Phân loại/đối chiếu tham chiếu |
| `backend/migrations/003_domain_guards.sql` | Schema/trigger SQL cần để nâng cấp database | Phân loại/đối chiếu tham chiếu |
| `backend/migrations/004_provenance_guards.sql` | Schema/trigger SQL cần để nâng cấp database | Phân loại/đối chiếu tham chiếu |
| `backend/migrations/005_bm_workflow.sql` | Schema/trigger SQL cần để nâng cấp database | Phân loại/đối chiếu tham chiếu |
| `backend/rag/__init__.py` | Định danh package Python | Python AST hợp lệ |
| `backend/rag/answers.py` | Gemini/mẫu và kiểm tra citation | Python AST hợp lệ |
| `backend/rag/check.py` | Kiểm tra provider RAG thật | Python AST hợp lệ |
| `backend/rag/search.py` | Truy xuất và lọc phạm vi nguồn | Python AST hợp lệ |
| `backend/rag/vectors.py` | Embedding và sqlite-vec | Python AST hợp lệ |
| `backend/README.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `backend/requirements-dev.txt` | Danh sách dependency chạy hoặc kiểm thử | Phân loại/đối chiếu tham chiếu |
| `backend/requirements.txt` | Danh sách dependency chạy hoặc kiểm thử | Phân loại/đối chiếu tham chiếu |
| `backend/security.py` | Mật khẩu và token | Python AST hợp lệ |
| `backend/setup_demo.py` | Thiết lập máy mới an toàn | Python AST hợp lệ |
| `backend/store.py` | SQLite và serialize hồ sơ | Python AST hợp lệ |
| `backend/tests/conftest.py` | Cấu hình kiểm thử | Python AST hợp lệ |
| `backend/tests/test_answers.py` | Kiểm thử hồi quy answers | Python AST hợp lệ |
| `backend/tests/test_api.py` | Kiểm thử hồi quy api | Python AST hợp lệ |
| `backend/tests/test_browser_import.py` | Kiểm thử hồi quy browser_import | Python AST hợp lệ |
| `backend/tests/test_demo_roles.py` | Kiểm thử hồi quy demo_roles | Python AST hợp lệ |
| `backend/tests/test_domain.py` | Kiểm thử hồi quy domain | Python AST hợp lệ |
| `backend/tests/test_knowledge.py` | Kiểm thử hồi quy knowledge | Python AST hợp lệ |
| `backend/tests/test_samples.py` | Kiểm thử hồi quy samples | Python AST hợp lệ |
| `backend/tests/test_search.py` | Kiểm thử hồi quy search | Python AST hợp lệ |
| `backend/tests/test_setup_demo.py` | Kiểm thử hồi quy setup_demo | Python AST hợp lệ |
| `backend/tests/test_vectors.py` | Kiểm thử hồi quy vectors | Python AST hợp lệ |
| `backend/tests/test_workflow.py` | Kiểm thử hồi quy workflow | Python AST hợp lệ |
| `backend/workflow.py` | Hỗ trợ BM, kết thúc và báo cáo | Python AST hợp lệ |
| `Cai-dat-demo.cmd` | Lệnh cài/chạy/kiểm tra dành cho Windows | Phân loại/đối chiếu tham chiếu |
| `Chay-demo.cmd` | Lệnh cài/chạy/kiểm tra dành cho Windows | Phân loại/đối chiếu tham chiếu |
| `docs/data/inventory/CNC-SOURCE-INVENTORY.csv` | Kiểm kê/xác minh nguồn | CSV 7 dòng; 19 cột |
| `docs/data/inventory/HOZENDX-VERIFICATION.csv` | Kiểm kê/xác minh nguồn | CSV 28 dòng; 9 cột |
| `docs/data/templates/CNC-REAL-SOURCES-TEMPLATE.csv` | Mẫu thu thập | CSV 0 dòng; 19 cột |
| `docs/design/DENSO-HOZENDX-INTEGRATION.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/design/DENSO-RAG-DATA-AUDIT.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/design/DENSO-RAG-DESIGN.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/design/DENSO-RAG-MVP-SCOPE.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/design/DENSO-STEP5-DATA-MODEL.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/BM-WORKFLOW-DEMO.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/DEMO-HANDOVER.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/DENSO-DEMO-SAMPLE-DATA.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/DENSO-RAG-VECTOR-GEMINI.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/GITHUB-SHARING.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/guides/KNOWLEDGE-RAG-DEMO.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `docs/history/DENSO-DEMO-PLAN.md` | Tài liệu lịch sử | Đối chiếu liên kết local |
| `docs/history/DENSO-STEP4-IMPLEMENTATION.md` | Tài liệu lịch sử | Đối chiếu liên kết local |
| `docs/history/DENSO-STEP7-SEARCH.md` | Tài liệu lịch sử | Đối chiếu liên kết local |
| `docs/history/DENSO-STEP8-ANSWERS.md` | Tài liệu lịch sử | Đối chiếu liên kết local |
| `docs/history/DENSO-STEP9-DEMO-REVIEW.md` | Tài liệu lịch sử | Đối chiếu liên kết local |
| `docs/README.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `fixtures/cases/cnc-demo-cases.json` | JSON mô phỏng có vai trò trong seed/adapter/RAG | JSON hợp lệ |
| `fixtures/hozendx/cnc-04.mock.json` | JSON mô phỏng có vai trò trong seed/adapter/RAG | JSON hợp lệ |
| `fixtures/rag/cnc-demo-questions.json` | JSON mô phỏng có vai trò trong seed/adapter/RAG | JSON hợp lệ |
| `fixtures/rag/cnc-demo-sources.json` | JSON mô phỏng có vai trò trong seed/adapter/RAG | JSON hợp lệ |
| `fixtures/rag/README.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `frontend/assets/css/fonts.css` | Kiểu giao diện đang được HTML/CSS tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/css/styles.css` | Kiểu giao diện đang được HTML/CSS tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/css/theme-compat.css` | Kiểu giao diện đang được HTML/CSS tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/OFL.txt` | Giấy phép font bắt buộc giữ cùng tài nguyên | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-1.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-2.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-3.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-4.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-5.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/fonts/plus-jakarta-sans-6.ttf` | Font giao diện được fonts.css tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/images/login-factory-cinematic.png` | Logo/ảnh nền giao diện đang được tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/images/logonho.png` | Logo/ảnh nền giao diện đang được tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/images/logotachnen.png` | Logo/ảnh nền giao diện đang được tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/assets/js/app.js` | Menu, chọn vai trò và điều hướng | Phân loại/đối chiếu tham chiếu |
| `frontend/index.html` | Trang giao diện hoặc workspace | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/backend.js` | Phiên API và kết nối hồ sơ với backend | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/cases.js` | Màn hình nghiệp vụ và hồ sơ prototype | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/core.js` | Khung giao diện và tiện ích dùng chung | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/data.js` | Dữ liệu prototype/mock | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/database-views.js` | Các màn hình đọc SQLite qua API | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/knowledge-api.js` | Đề xuất/kho/duyệt qua API | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/knowledge.js` | Màn hình tri thức và prototype | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/presentation-engine.js` | Điều khiển kịch bản trình bày | Phân loại/đối chiếu tham chiếu |
| `frontend/prototype/presentation.js` | Chế độ hướng dẫn/trình bày | Phân loại/đối chiếu tham chiếu |
| `frontend/workspace/workspace.css` | Kiểu giao diện đang được HTML/CSS tham chiếu | Phân loại/đối chiếu tham chiếu |
| `frontend/workspace/workspace.html` | Trang giao diện hoặc workspace | Phân loại/đối chiếu tham chiếu |
| `frontend/workspace/workspace.js` | Hồ sơ/nhật ký/BM/RAG dùng API | Phân loại/đối chiếu tham chiếu |
| `Kiem-tra-RAG.cmd` | Lệnh cài/chạy/kiểm tra dành cho Windows | Phân loại/đối chiếu tham chiếu |
| `README.md` | Hướng dẫn/thiết kế/mục lục | Đối chiếu liên kết local |
| `Tao-chi-muc-RAG.cmd` | Lệnh cài/chạy/kiểm tra dành cho Windows | Phân loại/đối chiếu tham chiếu |

## Dữ liệu riêng trên máy

Giữ `.env`, hai database hiện dùng, các backup migration, bản xuất hồ sơ và gói bàn giao. Kết quả sinh tự động được tập trung vào `.runtime/reports/`; chi tiết kiểm tra nằm trong `file-audit.json` tại đó.

Đã chuyển tài liệu sử dụng vào `guides/`, thiết kế vào `design/`, lịch sử vào `history/`; CSV được tách `data/templates/` và `data/inventory/`. Báo cáo STEP9 đã ra khỏi docs và không còn được đưa vào gói mã nguồn.

Không phát hiện file trùng nội dung trong danh sách sau phân loại.
