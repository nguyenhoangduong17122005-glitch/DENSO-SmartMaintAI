# Chia sẻ GitHub và kiểm tra bản demo

Bước 5 chốt bản demo: kiểm tra luồng nghiệp vụ, tài liệu sử dụng và khả năng cài trên máy mới. Các chức năng PM/thông báo còn mô phỏng được ghi trong README; đây chưa phải bản triển khai nhà máy.

## Nội dung đưa lên repo

Đưa `backend/`, `frontend/`, `fixtures/`, `docs/`, `scripts/`, `.github/`, các file `.cmd`, `.env.example`, `.gitignore`, `.dockerignore`, `Dockerfile`, `compose.yaml`, `render.yaml` và `README.md` lên repo. Giữ ảnh README, font cục bộ và giấy phép font. Dữ liệu mẫu trong `fixtures/` giúp người tải tự khởi tạo database, gồm 3 bài học và 3 nguồn xuất bản trên giao diện mới.

Không đưa `.env`, `.runtime/`, `.venv/`, database SQLite, log, cache hoặc bản sao lưu lên repo. `.gitignore` đã loại chúng khi dùng Git; tải file trực tiếp bằng giao diện GitHub vẫn cần tự loại các file này. Người tải repo dùng API key và database riêng; dữ liệu đang lưu trên máy tác giả không được chuyển sang máy họ.

Tài liệu đã chia thành `docs/guides/`, `docs/design/`, `docs/history/`. `docs/data/` chỉ giữ mẫu và bảng kiểm kê/xác minh; kết quả kiểm thử sinh tự động nằm trong `.runtime/reports/`.

Tạo repo trống trong tài khoản GitHub, chọn mức hiển thị phù hợp. Trong thư mục dự án, sau khi kiểm tra danh sách file:

```powershell
git init
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Prepare SmartMaint demo for sharing"
git branch -M main
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

Thay `OWNER/REPOSITORY` bằng repo thực tế. Git có thể yêu cầu đăng nhập GitHub qua trình duyệt; không ghi token vào mã nguồn hoặc URL. Trước commit, danh sách staged phải không có `.env`, `.runtime`, database hoặc dữ liệu riêng. Nếu repo đã có nội dung, đồng bộ và kiểm tra trước khi đẩy; không dùng force push.

## Người nhận chạy thế nào?

1. Tải ZIP và giải nén hoặc clone repo.
2. Cài Python; chạy `Cai-dat-demo.cmd` rồi `Chay-demo.cmd` trên Windows.
3. Mở `http://127.0.0.1:8001/`, chọn **Người bảo trì — Nguyễn Minh**.
4. Dùng kịch bản [BM](BM-WORKFLOW-DEMO.md), tiếp tục [đề xuất và duyệt tri thức](KNOWLEDGE-RAG-DEMO.md).
5. Muốn Gemini thật, cấu hình API key riêng theo [hướng dẫn RAG](DENSO-RAG-VECTOR-GEMINI.md). Chạy file kiểm tra RAG sẽ dùng hạn mức API.

GitHub lưu mã nguồn; địa chỉ `127.0.0.1` chạy trên máy của từng người. GitHub Pages không chạy backend Python/SQLite này. Dự án đã có [Live Demo dùng chung](https://denso-smartmaint-demo.onrender.com/) trên Render với database Turso. Bản clone chạy local không tự đồng bộ dữ liệu với website; triển khai bản riêng theo [hướng dẫn hosting](LIVE-DEMO-DEPLOYMENT.md).

## Kiểm tra trước khi bàn giao

- Cài trên thư mục mới không có `.env` và `.runtime`; chọn được vai trò, mở được hồ sơ mẫu.
- Tạo hồ sơ có tên riêng, thêm ghi nhận, tải lại trang; dừng rồi chạy lại máy chủ, hồ sơ vẫn còn.
- Mời chuyên gia → nhận hỗ trợ → ghi nhật ký → xác nhận đóng góp → kết thúc đợt/công việc → lập và xác nhận báo cáo.
- Tạo đề xuất từ báo cáo → chuyển sang chuyên gia trưởng duyệt → xuất bản → tìm được nguồn tri thức mới và trích dẫn trong RAG.
- Bản nháp hoặc bị từ chối không xuất hiện trong nguồn RAG; vai trò ngoài quyền không xem/sửa được hồ sơ.
- Chạy kiểm thử tự động offline và kiểm tra UI:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m backend.tools.browser_smoke --original-ui
```

Browser smoke mặc định cần Edge; có thể chỉ định executable qua `SMARTMAINT_EDGE`. Kiểm tra Gemini thật là bước riêng, cần key và mạng; bộ test offline không chứng minh provider đang hoạt động.
