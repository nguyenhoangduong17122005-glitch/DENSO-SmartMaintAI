# Bước 1 — Phạm vi MVP RAG cho CNC

Ngày: 09/10/2026. Người dùng đã chọn nhóm máy **CNC — rung hoặc nhiệt độ bất thường**. Các giới hạn và tiêu chí dưới đây là phạm vi làm việc đề xuất để triển khai từng bước; lựa chọn CNC không đồng nghĩa đã xác nhận dữ liệu thật hoặc khả năng tích hợp.

Thiết kế tổng thể: [DENSO-RAG-DESIGN.md](DENSO-RAG-DESIGN.md). Tài liệu này cụ thể hóa phạm vi lần triển khai đầu tiên; chức năng hỏi kho độc lập và các tác vụ AI khác trong thiết kế tổng thể được chuyển sang giai đoạn tiếp theo.

## 1. Mục tiêu và người sử dụng

Người bảo trì đang làm hồ sơ CNC có thể tra cứu tri thức/case đã duyệt theo hiện tượng và điều kiện thực tế, đọc nguồn đúng phiên bản, hiểu điểm phù hợp/khác biệt và chọn hướng tham khảo trong thẩm quyền.

Chuyên gia CNC đánh giá nguồn, kết quả tra cứu và các tình huống thiếu căn cứ trong pilot. Chuyên gia trưởng tiếp tục duyệt tri thức qua luồng hiện có; MVP không thay quy trình hoặc tự cấp quyền duyệt.

Hai tình huống nghiệp vụ mục tiêu:

- **Rung bất thường:** ghi nhận vị trí, thời điểm, chế độ/tốc độ đã quan sát, model sản phẩm, thay đổi liên quan và kết quả kiểm tra nếu có; tìm nguồn tương ứng.
- **Nhiệt độ bất thường:** ghi nhận bộ phận/vị trí đo, số đo và đơn vị nếu có, cách đo, điều kiện tải/chế độ, thời điểm và diễn biến; đối chiếu với nguồn được cấp. Không tự tạo ngưỡng nhiệt độ.

Các thông tin chưa biết được giữ là chưa biết; không chặn tra cứu chỉ vì thiếu số đo. Kết quả phải nêu thiếu dữ kiện nếu chưa đủ để đề xuất kiểm tra cụ thể. Nếu bước 2 chưa có nguồn nhiệt độ đã duyệt, tình huống nhiệt độ sẽ dùng để kiểm tra hành vi thiếu căn cứ, chưa được coi là chức năng đã có khả năng tư vấn đầy đủ.

## 2. Luồng MVP

1. Mở/tiếp tục hồ sơ CNC đã xác minh máy và quyền, theo SQ08.
2. Người bảo trì nhập/lưu hiện tượng, điều kiện, Alarm và 5M1E liên quan; giữ riêng model máy và model sản phẩm.
3. Nhấn **Tra cứu hướng xử lý**, theo SQ09. Backend đọc bối cảnh và nhật ký được phép dùng từ snapshot hiện tại.
4. Tìm nguồn trong kho đã duyệt, đúng phạm vi và còn hiệu lực; kết hợp mã chính xác, từ khóa và vector.
5. Hiển thị nguồn phía trên, phân tích phía dưới: điểm khớp/khác, dữ kiện thiếu, kiểm tra có căn cứ và giới hạn áp dụng.
6. Mở toàn văn đúng phiên bản, theo SQ14; người dùng chọn hướng tham khảo và ghi lý do. Chọn nguồn chưa có nghĩa đã thực hiện hoặc sửa xong.
7. Khi thêm dữ kiện hoặc nhật ký liên quan, đánh dấu lần tra cứu cũ cần cập nhật, giữ lịch sử và cho tra cứu lại.
8. Thiếu căn cứ/mâu thuẫn thì bổ sung dữ kiện hoặc dùng luồng yêu cầu chuyên gia hiện có; không bắt buộc chờ AI để xin hỗ trợ.

PM chỉ đi vào luồng này khi cần điều tra bất thường. PM bình thường tiếp tục checklist.

## 3. Trong phạm vi lần đầu

| Hạng mục | Kết quả cần có |
|---|---|
| Phạm vi máy | Nhóm CNC; danh sách máy pilot thật xác định ở bước 2 |
| Giao diện | Tích hợp vào tab nguồn/tra cứu của hồ sơ BM/PM hiện tại |
| Nguồn | Tri thức/case đã duyệt và tài liệu được phê duyệt; có ID, phiên bản, quyền và phạm vi áp dụng |
| Truy xuất | Exact lookup + tìm văn bản + vector; lọc quyền và hiệu lực cho mọi nhánh |
| Trả lời | Có citation cho nhận định kỹ thuật; nêu điểm khác, phần chưa biết và giới hạn |
| Chọn nguồn | Lưu case, người chọn, thời điểm, ID/phiên bản và lý do |
| Tính nhất quán | Kiểm tra context revision và snapshot các dữ kiện liên quan; kết quả cũ không tự áp dụng |
| Phục hồi | Phân biệt không tìm thấy nguồn, lỗi truy xuất, model lỗi; giữ dữ liệu và cho thử lại/đọc nguồn hợp lệ |
| Đánh giá | Bộ tình huống CNC do chuyên gia xác nhận; lưu phản hồi về độ liên quan và khả năng áp dụng |

Backend, lưu trữ và kiểm tra quyền đủ cho luồng này là phần nền bắt buộc. Mức xác thực cho demo nội bộ và pilot nhà máy sẽ được xác định khi xây backend; pilot không dựa vào đổi tài khoản demo hoặc ẩn menu để bảo vệ dữ liệu.

## 4. Để giai đoạn sau

- Mở rộng Vision/Máy ép và hỏi đáp kho độc lập với hồ sơ.
- AI cấu trúc ghi chú, đối chiếu trùng/cập nhật/liên kết, tóm tắt bàn giao và soạn báo cáo tự động.
- Import file/ghi âm trên màn hình chuyên gia, voice-to-text.
- Kết nối API HozenDX trực tiếp, lịch PM tự động và ghi trả HozenDX; MVP có thể dùng dữ liệu nhập có kiểm soát trong khi chờ xác minh tích hợp.
- Dự đoán hỏng hóc từ cảm biến thời gian thực, tự điều khiển máy, tự xác nhận nguyên nhân hoặc tự quyết định thay linh kiện.

Luồng nghiệp vụ sẵn có như nhật ký, yêu cầu chuyên gia và kiểm duyệt vẫn được dùng khi cần. “Để sau” ở đây là chưa bổ sung AI/API mới cho các luồng đó trong lần triển khai đầu.

## 5. Hiện trạng dữ liệu CNC trong prototype

| Dữ liệu hiện có | Cách dùng |
|---|---|
| Máy `CNC-04`, model `MC-400` | Mã/model mô phỏng để phát triển luồng, không phải máy pilot đã xác minh |
| `KN-031` v1, tri thức rung trạng thái published | Nguồn demo cho hành vi tra cứu có dẫn chứng; không chứa biện pháp sửa cụ thể |
| Đề xuất `DP-027`, nhiệt độ, trạng thái changes | Tình huống kiểm tra loại trừ nguồn chưa duyệt; không được dùng làm nguồn trả lời chung |
| `SOP-CNC-04` v3.0 chỉ có summary | Không đủ toàn văn để sinh hướng dẫn thao tác hoặc ngưỡng |
| `HZ-BM-0786`, lịch sử rung | Hồ sơ thô tham chiếu; không tự coi là tri thức đã duyệt |

Dữ liệu hiện tại đủ để dựng luồng demo và kiểm tra giới hạn. Pilot cần nguồn CNC thực tế đã được phép sử dụng; bước 1 chưa xác nhận đã có các nguồn này.

## 6. Tiêu chí hoàn thành MVP

1. Từ hồ sơ CNC có bối cảnh đã lưu, người có quyền thực hiện được toàn bộ luồng tra cứu → mở nguồn → chọn tham khảo.
2. Nguồn trả về có ID/phiên bản/phạm vi; mỗi nhận định kỹ thuật quan trọng có dẫn chứng hỗ trợ đúng nội dung, được chuyên gia kiểm tra.
3. Các tình huống thiếu số đo, thiếu toàn văn SOP hoặc thiếu nguồn nhiệt độ trả lời rõ giới hạn; không tự tạo thông số hay kết luận nguyên nhân.
4. Nguồn pending/changes/rejected, nguồn ngoài quyền, bị thu hồi hoặc sai môi trường không đi vào câu trả lời trong bộ kiểm thử.
5. Bối cảnh/nhật ký thay đổi làm kết quả cũ hết hiệu lực để áp dụng; lỗi AI không ghi đè dữ liệu hoặc thay đổi trạng thái máy/công việc/báo cáo.
6. Chọn nguồn không tự đánh dấu thao tác đã làm hoặc công việc thành công; gửi lại thao tác không tạo bản ghi trùng.
7. Đánh giá trên bộ câu hỏi CNC có nguồn chuẩn, tách tập hiệu chỉnh và nghiệm thu. Mục tiêu Recall@5 ban đầu ≥ 90% với câu hỏi có đáp án; báo cáo riêng các câu thiếu nguồn. Quy mô bộ thử và độ trễ mục tiêu được chốt khi biết dữ liệu/hạ tầng.

## 7. Đầu ra bước 1 và đầu vào bước 2

**Đã xác nhận bởi người dùng:** CNC là nhóm thử nghiệm đầu tiên; tình huống rung hoặc nhiệt độ bất thường.

**Phạm vi triển khai đề xuất:** tra cứu theo hồ sơ là chức năng đầu tiên, cùng truy vết nguồn, phiên bản, quyền và phản hồi; các tác vụ AI khác triển khai sau.

**Bước 2:** lập danh mục nguồn thực tế cho CNC. Với mỗi tài liệu/case cần biết ID/tên, định dạng, model máy, chủ đề rung/nhiệt độ, phiên bản, người duyệt, hiệu lực, phạm vi người đọc, nơi lưu và quyền sử dụng. Ưu tiên xác minh nguồn hiện có trước khi chọn model hoặc viết pipeline. Chưa chuyển sang thu thập/nhập dữ liệu trong bước 1 này.

**Cập nhật bước 2:** người dùng xác nhận chưa có dữ liệu thực tế và chọn chuẩn bị mẫu kiểm kê trước. Mẫu và hướng dẫn đã có tại [DENSO-RAG-DATA-AUDIT.md](DENSO-RAG-DATA-AUDIT.md). Có thể phát triển luồng bằng dữ liệu demo; pilot thực tế vẫn cần nguồn được xác minh và phê duyệt.
