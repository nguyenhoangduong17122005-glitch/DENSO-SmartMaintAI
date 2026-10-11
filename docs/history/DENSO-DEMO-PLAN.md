# Phạm vi demo đơn giản

> Tài liệu lịch sử của giai đoạn trước. Trạng thái hiện tại: [bàn giao demo](../guides/DEMO-HANDOVER.md).

> Tài liệu này ghi lại kế hoạch đơn giản hóa ban đầu. Tình trạng bàn giao ngày 11/10/2026 nằm ở [DEMO-HANDOVER.md](../guides/DEMO-HANDOVER.md). Hiện đã có chọn vai trò, Gemini/vector, luồng BM đầy đủ và duyệt/xuất bản tri thức; các đoạn “chưa nối LLM” hoặc “tạm hoãn báo cáo/duyệt” bên dưới là lịch sử kế hoạch.

Theo yêu cầu ngày 10/10/2026, ưu tiên bản demo dễ chạy và dễ trình bày. Tài liệu này thay thế các yêu cầu triển khai pilot/production trong kế hoạch trước đối với công việc tiếp theo. Các tài liệu kỹ thuật cũ giữ làm tham khảo.

## Luồng trình bày chính

1. Đăng nhập bằng tài khoản demo hiện có, mở hồ sơ CNC-04 đã chuẩn bị.
2. Nhập hiện tượng rung hoặc nhiệt độ bất thường; thông tin khác chỉ bổ sung khi cần.
3. Tra cứu tài liệu mẫu, xem nguồn và phần giải thích phù hợp với hiện tượng.
4. Ghi nhận việc kiểm tra/kết quả vào nhật ký.
5. Nếu cần trình bày chuyên gia, đổi sang tài khoản chuyên gia để xác nhận nhóm đóng góp.

Bước tra cứu ở mục 3 đã có **tìm kiếm từ khóa và mở tài liệu nguồn** ở bước 7; chưa có phần giải thích tổng hợp bằng LLM. Các bước hồ sơ/nhật ký/xác nhận đã có. Không cần tạo hồ sơ mới hoặc nhập đầy đủ 5M1E mỗi lần trình bày.

## Đơn giản hóa từng phần

| Phần | Cách làm cho demo |
|---|---|
| Tình huống | Một máy CNC, hai hiện tượng rung/nhiệt độ; ưu tiên hoàn thiện tình huống rung trước |
| Tài liệu | Chuẩn bị khoảng 5–10 tài liệu/case ngắn bằng Markdown hoặc JSON, có mã nguồn, nội dung và nhãn dữ liệu mô phỏng |
| HozenDX | Dùng fixture mock hiện có; tạm dừng yêu cầu tìm API, đồng bộ và ghi trả |
| Cơ sở dữ liệu | Giữ SQLite; chưa cần PostgreSQL, pgvector, Docker hoặc dịch vụ riêng |
| Phân quyền | Dùng các tài khoản seed hiện có; chỉ cần bảo trì và chuyên gia cho kịch bản chính, chưa thêm SSO/quản trị tài khoản |
| Biểu mẫu | Hiện tượng là thông tin chính; thông tin vận hành, số đo, thời điểm và 5M1E nằm trong phần tùy chọn |
| Nhật ký | Dùng hồ sơ mẫu để trình bày; giữ lịch sử và xác nhận đang hoạt động, chưa mở rộng workflow |
| Truy xuất ban đầu | Tìm từ khóa/mã máy trên bộ nguồn nhỏ; hiển thị các đoạn phù hợp cùng mã tài liệu. Chỉ thêm embedding nếu tìm từ khóa chưa đáp ứng |
| Trả lời | Trước hết hiển thị đoạn nguồn và tóm tắt theo mẫu, gắn nhãn rõ chưa dùng AI. Khi có cấu hình model mới nối LLM để thành luồng RAG thực sự |
| Báo cáo/duyệt | Tạm hoãn luồng soạn báo cáo, phân công duyệt, xuất bản và worker index; dùng nguồn mẫu được chọn trước cho demo |
| Đánh giá | Khoảng 10 câu hỏi mẫu: có nguồn, thiếu nguồn, khác máy và thiếu dữ kiện. Kiểm tra trả đúng nguồn và không bịa thông số; chưa cần bộ benchmark lớn |
| Chạy thử | Một backend local và trình duyệt; chưa triển khai cloud hoặc vận hành nhà máy |

Tìm kiếm tài liệu hoặc câu trả lời theo mẫu cần được gọi đúng là tìm kiếm/demo mô phỏng. Chỉ gọi là RAG có LLM khi thực sự truy xuất nguồn rồi đưa vào model để sinh câu trả lời. Mọi nguồn tự soạn phải có nhãn mô phỏng; không biến số đo hoặc biện pháp mẫu thành kết luận thực tế.

## Thứ tự làm tiếp

**Bước 6 đã hoàn thành:** [8 tài liệu CNC mô phỏng và 10 câu hỏi mẫu](../../fixtures/rag/README.md). **Bước 7 đã có** [giao diện/API tra cứu từ khóa và đọc nguồn](DENSO-STEP7-SEARCH.md); chưa nối LLM.

**Bước 8:** đã có [trả lời theo mẫu và adapter Gemini tùy chọn](DENSO-STEP8-ANSWERS.md). Chế độ mẫu chạy được ngay; chưa kiểm chứng gọi model thật vì chưa có cấu hình key/model.

**Bước 9 hoàn thành cho demo local:** [kết quả 10 câu hỏi và kịch bản trình bày 5 phút](DENSO-STEP9-DEMO-REVIEW.md). Có lệnh `py -m backend.tools.demo_check` để chạy lại API trên DB riêng; Gemini thật cần kiểm tra sau khi cấu hình.

1. Soạn bộ nguồn CNC mô phỏng nhỏ để có nội dung tra cứu hoàn chỉnh.
2. Thêm ô hỏi/tra cứu ngay trong hồ sơ; backend tìm nguồn và trả mã tài liệu/đoạn nội dung.
3. Thêm phần trả lời theo mẫu, nêu dữ kiện thiếu và liên kết nguồn; nối LLM nếu có cấu hình phù hợp.
4. Chạy bộ câu hỏi demo và viết kịch bản trình bày ngắn.

## Điều chỉnh đã áp dụng

Giao diện bối cảnh chỉ hiển thị hiện tượng, Alarm và bộ phận ở phần chính. Các điều kiện vận hành và 5M1E được thu gọn; phần số đo/thời điểm của nhật ký cũng nằm trong thông tin bổ sung. Trạng thái dùng tiếng Việt, thông tin phiên bản không nằm ở phần lưu chính. Giữ dữ liệu và các ràng buộc backend đã có để không phải xây lại.
