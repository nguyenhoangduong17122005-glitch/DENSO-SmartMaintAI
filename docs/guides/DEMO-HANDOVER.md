# Bàn giao demo DENSO SmartMaintAI

Cập nhật **12/10/2026**, sau khi đổi frontend theo mẫu Netlify và thêm bài học/tri thức. [Live Demo](https://denso-smartmaint-demo.onrender.com/) · [GitHub](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI) · [README chính](../../README.md).

## Giao diện hiện tại

- Người bảo trì: **Tổng quan**, **Ca bảo trì**, **Kho tri thức**, **Bài học từ ca**.
- Chuyên gia: **Hỗ trợ hiện trường**, **Hồ sơ tham gia**, **Tri thức của tôi**, cùng tổng quan và kho tri thức.
- Chuyên gia trưởng: **Tổng quan**, **Kiểm duyệt tri thức**, **Kho tri thức**.
- Chi tiết ca: **Bối cảnh & máy**, **Tra cứu & căn cứ**, **Xử lý & nhật ký**, **Báo cáo tổng kết**.

Thiết kế dùng nền sáng, điểm nhấn đỏ, font Plus Jakarta Sans và ảnh/logo cục bộ. Frontend gọi API đọc/lưu BM và tri thức. Chuyển tab giữ phần đang nhập nhưng chưa tự lưu. Tiêu đề phụ “Đề xuất của tôi” đã bỏ trên màn hình **Bài học từ ca**. [Bản đồ frontend](../../frontend/README.md).

## Dữ liệu và cách chạy

Máy mới: clone/giải nén → `Cai-dat-demo.cmd` → `Chay-demo.cmd` → **http://127.0.0.1:8001/** → chọn vai trò. Hoặc dùng Docker theo README. Mặc định từ khóa/trả lời mẫu không cần Gemini.

Ứng dụng tạo một lần **5 tài khoản và 8 hồ sơ mẫu**: 5 hồ sơ ban đầu, 3 ca đã kết thúc có báo cáo xác nhận, 3 bài học đã duyệt và 3 nguồn xuất bản. Các mẫu mới thuộc Nguyễn Minh, có `[DEMO]` và giới hạn áp dụng. Khởi động lại không ghi đè dữ liệu hoặc tự xuất bản lại nguồn đã thu hồi. [Mã mẫu và nội dung](DENSO-DEMO-SAMPLE-DATA.md).

| Bản chạy | Database nghiệp vụ |
|---|---|
| Python local mặc định | `.runtime/smartmaint.sqlite3` |
| Docker local mặc định | Volume `smartmaint-data` |
| Live Demo Render | Turso/libSQL dùng chung theo quyền |

Các database này không tự đồng bộ. Trên Live Demo, người khác có thể thấy dữ liệu đã lưu nếu có quyền. Mở SQLite local bằng SQLite Viewer, không mở dưới dạng văn bản.

## Kiểm chứng

Các lần kiểm tra trước bao gồm browser smoke, luồng BM → báo cáo → duyệt → tri thức → RAG, adapter Turso và [Docker/libSQL trong CI](https://github.com/nguyenhoangduong17122005-glitch/DENSO-SmartMaintAI/actions/workflows/docker-smoke.yml). Kết quả rà soát hiện tại nằm trong [README](../../README.md#kiểm-thử-và-phạm-vi-demo).

Ngày 12/10/2026 đã đọc API Live Demo, xác nhận đủ **3 bài học mẫu, 3 nguồn xuất bản và báo cáo nguồn đã xác nhận**. Đây không phải kiểm thử toàn bộ nghiệp vụ cloud. Browser smoke dùng database/profile riêng để kiểm tra giao diện và lưu dữ liệu.

## Phạm vi bàn giao

Đã có BM, bối cảnh có phiên bản, nhật ký theo đợt, mời/nhận hỗ trợ, xác nhận đóng góp, đóng công việc, báo cáo, đề xuất, duyệt độc lập và xuất bản. RAG dùng từ khóa/mẫu hoặc Gemini/vector tùy cấu hình.

HozenDX và dữ liệu CNC là mô phỏng. PM/thông báo chưa có đầy đủ backend; chưa có AI soạn báo cáo, SSO hoặc xác thực production. Cập nhật/liên kết/rút tri thức và đính chính báo cáo sau chốt còn giới hạn. Bộ chọn vai trò dùng chung để trình diễn local và website công khai. [Đối chiếu sơ đồ](../design/WORKFLOW-CONFORMANCE.md).

Không đưa `.env`, `.runtime`, `.venv`, token, API key hoặc database cá nhân vào gói nộp. Giữ migration, module prototype đang nạp và giấy phép font. Hướng dẫn: [BM](BM-WORKFLOW-DEMO.md), [tri thức/RAG](KNOWLEDGE-RAG-DEMO.md), [hosting](LIVE-DEMO-DEPLOYMENT.md).
