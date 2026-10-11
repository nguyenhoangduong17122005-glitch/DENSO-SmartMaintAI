# Bàn giao bản demo — bước 5

Ngày kiểm tra: 11/10/2026. Bước 5 hoàn tất trong phạm vi demo chạy local và chuẩn bị mã nguồn để chia sẻ. Link Live Demo vẫn cần được xác minh sau khi triển khai hosting.

Bổ sung hồ sơ nộp dự án cùng ngày: README có kiến trúc/luồng dữ liệu Mermaid, 4 ảnh chụp thực tế và hướng dẫn Docker. Đã thêm Dockerfile, Compose, Blueprint Render tùy chọn và cấu hình host/origin HTTPS. Bộ test sau bổ sung: **170 passed**; browser smoke với ảnh README đạt. Docker build/chạy và giữ dữ liệu sau restart đã [đạt trên CI](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI/actions/runs/38124622577); chưa có URL Live Demo đã xuất bản. Repo đích hiện đã được cung cấp: [DENSO-SmartMaintAI](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI).

Bổ sung phương án miễn phí: Render Free + Turso Free (libSQL), adapter HTTPS và kiểm thử lưu/rollback/chống lặp, báo cáo → duyệt → xuất bản → RAG. [Kiểm tra với server libSQL thật trong CI đã đạt](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI/actions/runs/38131288432). Database cloud cần được tạo và cấu hình riêng; chưa xác minh triển khai cloud. Xem [hướng dẫn Live Demo](LIVE-DEMO-DEPLOYMENT.md).

## Năm bước đã thực hiện

1. Cấu hình và kiểm tra Gemini, embedding và chỉ mục vector bằng sqlite-vec.
2. Đồng bộ các màn hình nghiệp vụ BM với SQLite và quyền tài khoản.
3. Hoàn thiện luồng BM: mời/nhận hỗ trợ, nhật ký, xác nhận đóng góp, kết thúc công việc và báo cáo có phiên bản.
4. Tạo đề xuất từ báo cáo đã xác nhận, duyệt độc lập và xuất bản nguồn vào RAG.
5. Kiểm thử, bổ sung bộ cài trên máy mới, hướng dẫn sử dụng và chuẩn bị bản chia sẻ không chứa cấu hình riêng/database cá nhân.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Bộ test offline `py -m pytest backend/tests -q` | 170 passed (bổ sung hosting và remote storage) |
| Kiểm tra giao diện bằng Edge `py -m backend.tools.browser_smoke --original-ui` | Đạt, dùng database/profile riêng |
| Bản sao mới không có `.env`/database | Tạo cấu hình offline, 5 tài khoản và 5 hồ sơ mẫu |
| Chạy khởi tạo lần hai | Không tạo dữ liệu trùng; không thay cấu hình, mật khẩu hoặc hồ sơ đã có |
| API trên bản sao mới | Trang chính, chọn vai trò và mở hồ sơ mẫu hoạt động |
| File riêng qua HTTP | `.env`, database và mã backend trả 404 |
| Gói chia sẻ | Không chứa `.env`, `.runtime`, `.venv`, database hoặc API key hiện dùng |

Kiểm tra giao diện gồm tạo/lưu/tải lại dữ liệu, đổi vai trò, hỗ trợ BM, báo cáo, đề xuất/duyệt tri thức và tra cứu nguồn đã xuất bản. Bộ test tự động còn kiểm tra phạm vi quyền, CSRF, lịch sử phiên bản và lỗi khi xuất bản/index.

Gemini thật đã được kiểm tra ở các bước trước trong cùng phiên làm việc: tìm kiếm `vector_search`, sinh câu trả lời `gemini`, truy xuất và trích dẫn được tri thức mới đã duyệt trên database riêng. Bước 5 không gọi lại provider để tránh dùng thêm hạn mức. Máy người nhận phải cấu hình key riêng và chạy `scripts/windows/Kiem-tra-RAG.cmd` để xác minh kết nối của họ.

Bản sao mới được kiểm tra bằng Python và các thư viện đã cài trên máy phát triển. Chưa kiểm tra tải/cài thư viện từ Internet trên một máy Windows khác. File `Cai-dat-demo.cmd` cài đúng các phiên bản trong `backend/requirements.txt` vào `.venv`.

## Cách chạy và bàn giao

Trên máy mới: giải nén/clone → `Cai-dat-demo.cmd` → `Chay-demo.cmd` → chọn vai trò. Các lần sau chỉ chạy `Chay-demo.cmd`. Hướng dẫn chi tiết nằm trong [README](../../README.md), [kịch bản BM](BM-WORKFLOW-DEMO.md), [tri thức/RAG](KNOWLEDGE-RAG-DEMO.md) và [chia sẻ GitHub](GITHUB-SHARING.md).

Mỗi máy có database riêng trong `.runtime/`. Mở `.runtime/smartmaint.sqlite3` bằng SQLite Viewer để đối chiếu hồ sơ. Không mở SQLite dưới dạng văn bản. Khi kiểm tra lưu dữ liệu, tạo hồ sơ có tên riêng, tải lại trang rồi khởi động lại máy chủ và tìm lại hồ sơ.

## Giới hạn còn lại

HozenDX dùng mock; dữ liệu CNC là mô phỏng. PM và thông báo prototype chưa nối đầy đủ vào backend. Tri thức hiện tạo mới từ báo cáo BM, chưa hỗ trợ thay thế/rút tri thức đã xuất bản. Bộ chọn vai trò phục vụ demo local. Triển khai nhiều người dùng chung trên Internet, xác thực production và tích hợp HozenDX thật là phạm vi tiếp theo.

GitHub chia sẻ mã nguồn qua repo đích nêu ở đầu tài liệu. Một URL dùng chung cho cả nhóm cần triển khai backend, không chỉ bật GitHub Pages; xem hướng dẫn Live Demo để thực hiện bước hosting còn lại.
