# Bước 4 — Backend, xác thực và adapter mock

> Tài liệu lịch sử của giai đoạn trước. Trạng thái hiện tại: [bàn giao demo](../guides/DEMO-HANDOVER.md).

Ngày thực hiện: 09/10/2026. Phạm vi: nền backend local demo cho CNC; chưa chuyển sang RAG hoặc kết nối HozenDX thật.

## Đã triển khai

- FastAPI với API đăng nhập/đăng xuất/đọc phiên, không tự cấp vai trò từ trình duyệt.
- Mật khẩu PBKDF2-SHA256 với salt riêng; mật khẩu demo sinh ngẫu nhiên qua CLI, chỉ hiện khi tạo.
- Session cookie HttpOnly/SameSite=Strict, session hash và thời hạn ở server, thu hồi khi đăng xuất; bảo vệ CSRF và kiểm tra Origin cho mutation.
- Phân quyền theo máy, vai trò và tham gia hồ sơ ở server; chuyên gia trưởng không có quyền mặc định đọc mọi case.
- SQLite lưu tài khoản, quyền, phiên, hồ sơ/snapshot demo, audit trước/sau và kết quả thao tác để chống gửi lặp.
- Adapter đọc fixture CNC-04, giữ nhãn mô phỏng/chưa kết nối/chưa đồng bộ; chưa có API ghi HozenDX.
- Workspace mới kết nối API: xem máy/mock, đọc case/nhật ký demo, mở hồ sơ BM và sửa bối cảnh đúng quyền.
- Lưu bối cảnh kiểm tra cả context revision/data revision; xung đột không ghi đè. Gửi lại cùng key/payload không nhân đôi thao tác.
- Phục hồi phiên giữ phần nhập trong tab và chỉ khôi phục cùng tài khoản; mọi lần lưu vẫn kiểm tra quyền/revision hiện tại.
- Static routes dùng allowlist, không công khai DB, backend code hoặc fixture.

## Ranh giới dữ liệu

Workspace backend ở `/` và prototype đầy đủ ở `/prototype-demo` là hai môi trường riêng. Prototype cũ tiếp tục localStorage; không coi dữ liệu ở đó đã được xác thực/lưu vào backend. Chưa có migration dữ liệu trình duyệt.

Bảng cases và rounds JSON ở bước này là mô hình tối thiểu để thử quyền/lưu bối cảnh. Mô hình round/event/report/version đầy đủ, chỉnh nhật ký, PM tạo mới, kiểm duyệt, PostgreSQL/pgvector và RAG chưa thuộc kết quả bước 4. Seed BM-26028 là snapshot demo rút gọn, không phải bản nhập toàn bộ prototype hoặc dữ liệu nhà máy.

## Kiểm chứng

Đã chạy 40 kiểm thử API, bao phủ session, mật khẩu/khôi phục mật khẩu demo, CSRF, role spoof, quyền máy/đối tượng, thu hồi, xung đột revision, persistence qua tạo app lại, audit, idempotency, giới hạn mock và private files. Đã chạy Edge headless kiểm tra đăng nhập, lưu bối cảnh, phục hồi phần nhập khi phiên hết hạn, tạo ca, hai phạm vi tài khoản khác nhau và không tràn ngang ở màn hình 390px.

Hướng dẫn chạy và API: [backend/README.md](../../backend/README.md). Kiểm thử dùng DB tạm tách biệt với DB mặc định. Pilot thật vẫn cần SSO/HTTPS/quyền và dữ liệu được duyệt, tích hợp xác minh, backup và migration.

## Tiếp theo

Bước 5: chuẩn hóa mô hình nghiệp vụ `case → round → event`, revision/xác nhận/báo cáo/tri thức; quyết định migration từ nền SQLite demo sang PostgreSQL trước xây ingestion và truy xuất ở các bước sau.
