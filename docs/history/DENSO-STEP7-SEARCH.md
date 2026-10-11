# Bước 7 — Tìm kiếm tài liệu CNC mẫu

> Tài liệu lịch sử của giai đoạn trước. Trạng thái hiện tại: [bàn giao demo](../guides/DEMO-HANDOVER.md).

Cập nhật bước 9: tăng ưu tiên keyword/cụm từ khớp đầy đủ, kiểm tra nguồn đứng đầu với [bộ 10 câu hỏi demo](DENSO-STEP9-DEMO-REVIEW.md). Cách tìm vẫn là từ khóa, chưa dùng embedding.

Đã thêm tra cứu ngay trong hồ sơ backend demo. Dùng 8 nguồn/17 đoạn của bước 6, tìm từ khóa tiếng Việt có hoặc không dấu. Không cần thư viện mới, embedding, database vector hoặc cấu hình model. Chưa dùng LLM và chưa sinh câu trả lời tổng hợp.

## Dùng thử

Bản bước 7 hiện được chạy tại <http://127.0.0.1:8001/> vì cổng 8000 đang có tiến trình sử dụng. Dùng tài khoản hiện có; cùng DB demo. Nếu tự chạy lại, dùng `py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001`, hoặc khởi động lại backend của bạn ở cổng mong muốn để nạp API mới.

1. Mở workspace backend, đăng nhập bằng tài khoản hiện có và chọn BM-26028.
2. Trong **Tra cứu tài liệu CNC mẫu**, nhập `rung sau thay đồ gá` rồi nhấn **Tra cứu tài liệu**.
3. Đọc đoạn khớp và mã trích dẫn, ví dụ `DEMO-CNC-003@1.0#scenario`.
4. Nhấn **Xem toàn bộ tài liệu mẫu** để đọc các mục của đúng phiên bản nguồn.
5. Thử `ngưỡng nhiệt độ trục chính` để đọc giới hạn của bộ nguồn; thử `Vision camera không nhận sản phẩm` để thấy chưa có nguồn phù hợp.

Nút **Dùng hiện tượng đang nhập** chép nội dung hiện tượng vào ô hỏi; không lưu bối cảnh. Tra cứu hiện dùng câu hỏi người dùng nhập và phạm vi máy của hồ sơ, chưa tự phân tích toàn bộ nhật ký. Bản đang nhập trong các biểu mẫu khác được giữ nguyên.

## Cách tìm đơn giản

Python chuẩn đọc trực tiếp `fixtures/rag/cnc-demo-sources.json`. Loại nguồn không phải demo, không có nhãn mô phỏng hoặc chưa demo_ready; lọc mã máy/model theo hồ sơ trên server. Chuẩn hóa chữ thường, dấu tiếng Việt và dấu câu; bỏ từ thông dụng. Tính điểm khớp tiêu đề, keywords, tiêu đề mục và nội dung; lấy tối đa 5 tài liệu, mỗi tài liệu trả đoạn khớp nhất. Điểm chỉ phục vụ xếp hạng, không phải độ tin cậy chẩn đoán.

Kiểm tra ngoài phạm vi nhận diện các từ Vision/camera/máy ép và mã CNC/MC khác được nêu trong câu hỏi. Đây là quy tắc từ khóa nhỏ cho demo, chưa phải bộ hiểu ý định hoặc nhận diện mọi cách mô tả máy. Không diễn giải câu hỏi bằng LLM. Tìm kiếm có thể trả đoạn liên quan nhưng chưa trả lời đầy đủ, hoặc bỏ sót cách diễn đạt khác; người dùng đọc toàn bộ nguồn để đối chiếu.

## API

| API | Điều kiện/kết quả |
|---|---|
| GET `/api/cases/{id}/search?q=...&expectedCaseDataRevision=...` | Session + quyền máy + tham gia hồ sơ; câu hỏi 3–1000 ký tự; đúng revision; trả matches/no_match và các đoạn nguồn |
| GET `/api/cases/{id}/sources/{sourceId}?version=1.0` | Cùng quyền hồ sơ; chỉ trả đúng nguồn/phiên bản trong phạm vi máy |

401 khi chưa đăng nhập, 404 khi ngoài phạm vi hồ sơ hoặc không có phiên bản nguồn, 409 khi hồ sơ đã đổi, 422 khi câu hỏi sai và 503 khi không đọc được corpus. Lỗi đọc corpus không bị coi là không có kết quả. File fixture không được phục vụ trực tiếp qua static route. Tìm kiếm không ghi DB, không tạo báo cáo hoặc xác nhận công việc.

Response có `mode=keyword_search`, `llmUsed=false`, environment demo, nhãn mô phỏng và notice. Kết quả chỉ trích nguyên đoạn nguồn; không sinh ngưỡng, kết luận nguyên nhân hay bước sửa chữa mới. Trong trường hợp thiếu tiêu chuẩn, nguồn có thể chỉ nói rõ chưa có tiêu chuẩn: matches không đồng nghĩa đủ bằng chứng trả lời kỹ thuật.

## Kiểm chứng

Kết quả: **84 bài kiểm thử backend đạt**, bao gồm các bài mới của bước 7 và các luồng cũ. Edge browser smoke đạt tra cứu, mở nguồn đúng phiên bản, no-match và kiểm tra chiều ngang ở màn hình 390px.

Test backend kiểm tra 10 câu hỏi nguồn mẫu, tiếng Việt không dấu, nguyên văn trích dẫn, phạm vi máy, trạng thái nguồn, phân quyền, phiên bản, revision cũ và lỗi corpus. Bộ câu hỏi được dùng để kiểm tra nguồn liên quan xuất hiện trong tối đa 5 kết quả, không khẳng định có câu trả lời AI chính xác hoặc đã đạt benchmark RAG.

Browser smoke kiểm tra nhập câu hỏi, mở nguồn, không có kết quả và bố cục mobile, cùng các luồng hồ sơ/nhật ký cũ.

```powershell
py -m pytest backend/tests -q
py -m backend.tools.browser_smoke
```

Bước 8 mới bổ sung model để trả lời từ các đoạn được tìm thấy nếu có cấu hình model. Hiện tại đây là **demo tìm kiếm tài liệu có trích dẫn**, chưa phải RAG có LLM.
