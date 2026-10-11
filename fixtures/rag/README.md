# Bộ nguồn CNC cho demo — bước 6

Đã chuẩn bị **14 tài liệu mẫu và 10 câu hỏi kiểm tra ban đầu**. Tất cả nội dung do tác giả tự soạn cho kịch bản mô phỏng; không phải tài liệu DENSO, HozenDX, nhà chế tạo hoặc hồ sơ sửa chữa thật. `demo_ready` chỉ có nghĩa đã chọn cho demo, không có nghĩa được chuyên gia/nhà máy phê duyệt. Xem [4 hồ sơ và 6 nguồn mới](../../docs/guides/DENSO-DEMO-SAMPLE-DATA.md) cùng câu hỏi trình diễn.

## Các file

- [cnc-demo-sources.json](cnc-demo-sources.json): nguồn đầy đủ, chia sẵn thành 29 mục ngắn để tìm theo từ khóa.
- [cnc-demo-questions.json](cnc-demo-questions.json): 10 câu hỏi, nguồn kỳ vọng, điểm trả lời cần có và điều không được khẳng định. Đây là kỳ vọng thiết kế, chưa phải kết quả kiểm thử retrieval.

| Mã nguồn | Nội dung | Dùng để minh họa |
|---|---|---|
| DEMO-CNC-001 v1.0 | Lý lịch CNC-04 / MC-400 | Tìm thông tin máy, phân biệt model máy/sản phẩm |
| DEMO-CNC-002 v1.0 | Ghi nhận rung | Hỏi bổ sung điều kiện và số đo nếu có |
| DEMO-CNC-003 v1.0 | Case rung sau đổi đồ gá | Tìm case tương tự và so sánh điều kiện |
| DEMO-CNC-004 v1.0 | Case rung gián đoạn chưa kết luận | Không ép kết luận nguyên nhân hoặc thay linh kiện |
| DEMO-CNC-005 v1.0 | Ghi nhận nhiệt độ | Phân biệt cảm nhận nóng với số đo; thiếu tiêu chuẩn |
| DEMO-CNC-006 v1.0 | Case nóng sau chu kỳ dài | Giữ giả thuyết là giả thuyết |
| DEMO-CNC-007 v1.0 | Checklist và bản ghi PM | Không biến checklist trống thành kết quả đã làm |
| DEMO-CNC-008 v1.0 | Phạm vi và thiếu dữ kiện | Không có toàn văn SOP, không bịa ngưỡng hoặc thao tác |

Thông tin nhận diện máy và checklist được đối chiếu với [fixture HozenDX](../hozendx/cnc-04.mock.json). Case 003/004/006 được soạn mới; không gán lại nội dung cho KN-031, BM-26028 hoặc HZ-BM-0786. Không thay đổi phê duyệt hay nội dung của các đối tượng cũ.

## Cách dùng ở bước 7

Đọc trực tiếp JSON bằng Python chuẩn; không cần import DB, OCR, embedding hoặc dịch vụ mới. Lấy `documents`, chỉ dùng nguồn có environment demo, isSimulated true và status demo_ready; kiểm tra assetIds/model đúng hồ sơ trước tìm kiếm. Chưa có metadata phân quyền từng tài liệu vì toàn bộ nguồn dùng chung trong phạm vi máy demo; API vẫn cần kiểm tra quyền hồ sơ/máy.

Mỗi `sections` là một đoạn nguồn với tiêu đề và nội dung. Định danh trích dẫn: `documentId@version#sectionId`, ví dụ `DEMO-CNC-003@1.0#outcome`. Khi hiển thị đoạn, giữ kèm mã nguồn, phiên bản, tiêu đề và nhãn mô phỏng. Nếu sau này thêm chunking/embedding, giữ nguyên các định danh nguồn này.

Tìm kiếm ban đầu có thể dùng title/keywords/topics/sections và chuẩn hóa tiếng Việt. Không đưa các đáp án kỳ vọng trong file câu hỏi vào kho nguồn hoặc prompt để giả lập kết quả. `expectedSourceIds` là các nguồn phù hợp để đối chiếu thủ công, không yêu cầu một thuật toán đã đạt đúng thứ tự xếp hạng.

Q09 kiểm tra máy ngoài phạm vi: cần kiểm tra phạm vi máy trước khi tìm từ khóa. Q06/Q10 có nguồn nói rõ phần còn thiếu nhưng không có đáp án kỹ thuật; có kết quả tìm kiếm không đồng nghĩa đủ bằng chứng trả lời. Không bổ sung ngưỡng hoặc quy trình từ suy đoán.

## Giới hạn

Bước 7 đã có [API/giao diện tìm kiếm từ khóa và mở nguồn](../../docs/history/DENSO-STEP7-SEARCH.md), đọc trực tiếp file nguồn này. Chưa có LLM hoặc trả lời AI. Chưa nhập các nguồn vào bảng knowledge/knowledge_versions, không tạo quyết định duyệt và không gọi HozenDX. Kho dữ liệu thực tế đủ điều kiện vẫn là 0.
