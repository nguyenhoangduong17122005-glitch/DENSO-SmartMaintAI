# Bước 8 — Trả lời từ nguồn mẫu

> Tài liệu lịch sử của giai đoạn trước. Trạng thái hiện tại: [bàn giao demo](../guides/DEMO-HANDOVER.md).

Đã thêm nút **Trả lời từ nguồn** cạnh nút tra cứu trong hồ sơ CNC. Phạm vi demo đơn giản: không thêm database, thư viện hoặc dịch vụ nền. Mặc định dùng mẫu trích nguồn, chạy được khi không có API key. Có adapter Gemini tùy chọn; hiện môi trường chưa có key/model, vì vậy chưa kiểm chứng bằng một lần gọi model thật.

## Dùng ngay

Bản cập nhật chạy tại <http://127.0.0.1:8001/> với tài khoản và DB hiện có.

1. Mở hồ sơ BM-26028 bằng tài khoản hiện có.
2. Nhập `rung sau thay đồ gá`, nhấn **Trả lời từ nguồn**.
3. Phía trên là các tài liệu khớp; phía dưới là phần trả lời, nhãn chế độ và mã nguồn của từng đoạn.
4. Bấm mã nguồn để mở toàn bộ tài liệu đúng phiên bản.
5. Thử câu hỏi ngưỡng nhiệt độ hoặc máy Vision để xem phần thiếu dữ kiện/ngoài phạm vi.

Mặc định nhãn là **Trả lời theo mẫu · Chưa dùng AI**. Mẫu lấy nguyên văn các mục của tài liệu xếp đầu, giữ cả điều kiện và giới hạn của case; không tổng hợp hoặc diễn giải bằng model. Có quy tắc từ khóa đơn giản cho các câu hỏi ngưỡng, tháo máy và kết luận nguyên nhân để gắn nhãn thiếu bằng chứng; đây không phải phân loại ngữ nghĩa đầy đủ.

Tìm kiếm từ khóa + câu trả lời theo mẫu chưa phải RAG có LLM. Cấu hình model thành công mới bật luồng truy xuất → gửi nguồn vào model → trả lời có mã dẫn nguồn.

## Bật model khi muốn thử

Backend đọc **biến môi trường của tiến trình**, không tự đọc `.env` hay `.env.example`. Không nhập API key vào trình duyệt hoặc mã JavaScript. Trên PowerShell, đặt ba biến rồi khởi động backend:

```powershell
$env:SMARTMAINT_ANSWER_MODE = 'gemini'
$env:GEMINI_API_KEY = '<API key của bạn>'
$env:SMARTMAINT_GEMINI_MODEL = '<model bạn có quyền dùng, hỗ trợ Structured Outputs>'
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Nếu cổng đang dùng, dừng backend của bạn trước hoặc chọn cổng khác. Không có model mặc định tự chọn; quyền dùng model và quota cần kiểm tra với tài khoản của bạn. Muốn về mẫu: đặt SMARTMAINT_ANSWER_MODE=template rồi khởi động lại. Chỉ có key mà chưa bật mode gemini sẽ không gọi API.

Tùy chọn Gemini gửi **câu hỏi và các đoạn nguồn mô phỏng được tìm thấy**, không gửi toàn bộ DB, mật khẩu, nhật ký hoặc nội dung biểu mẫu chưa lưu khác. Nếu muốn giữ nội dung hoàn toàn local thì tiếp tục dùng template. API key chỉ dùng trong header request từ server.

Adapter dùng Gemini `generateContent`, systemInstruction và `generationConfig.responseFormat.text` để yêu cầu JSON theo schema. API key gửi trong header `x-goog-api-key`, không gắn vào URL. Giới hạn output 4096 token và timeout 25 giây; không tự retry. Cấu trúc dựa theo [Gemini API — generateContent](https://ai.google.dev/api/generate-content) và [Structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).

## Luồng xử lý

API `POST /api/cases/{id}/answer` nhận `{q, expectedCaseDataRevision}`. Cần session, CSRF, quyền máy và tham gia hồ sơ. Server tự lấy máy/model; client không được gửi nguồn hoặc danh tính thay thế.

Truy xuất tối đa 5 tài liệu như bước 7. Để tạo câu trả lời, lấy toàn bộ các mục của 3 tài liệu đầu nhằm giữ các phần kết quả/giới hạn liền kề. Trong template chỉ trích các mục của tài liệu đầu. Không dùng file câu hỏi/đáp án kỳ vọng làm nguồn.

Khi bật Gemini, yêu cầu model trả lời tiếng Việt từ nguồn đã cung cấp, giữ nhãn mô phỏng, không biến giả thuyết thành nguyên nhân hoặc tự tạo ngưỡng/quy trình. Nguồn và câu hỏi được xem là dữ liệu, không phải chỉ dẫn thay thế quy tắc. Mỗi nhận định phải có citation thuộc tập nguồn đã gửi. Backend kiểm tra JSON schema và citation trước hiển thị.

| Tình huống | Hiển thị |
|---|---|
| Mode template | Nguyên văn từ nguồn, nhãn chưa dùng AI |
| Gemini trả nội dung hợp lệ | Nhãn AI từ nguồn mô phỏng; citation từng nhận định |
| Thiếu key/model, API lỗi, timeout, từ chối, phản hồi dở dang hoặc citation không hợp lệ | Chuyển về mẫu với nhãn lý do chung; không lộ lỗi/secret từ nhà cung cấp |
| Không có nguồn phù hợp | Nêu chưa có nguồn; không gọi model |
| Nguồn không đọc được | 503, không giả thành không có kết quả |
| Hồ sơ hoặc corpus đổi trong khi chờ | 409; không trả nội dung như kết quả hiện hành |
| Session/quyền bị thu hồi trong khi chờ | 401/404; không trả nội dung kết quả |

Không giữ transaction DB trong lúc gọi model. Câu trả lời không ghi vào hồ sơ, báo cáo hoặc tri thức và không thay đổi trạng thái máy. API này không tự retry hoặc lưu lịch sử hội thoại; nhấn lại khi bật model có thể tạo request mới.

## Giới hạn kiểm chứng

Sau khi chuyển sang Gemini: **109 bài pytest đạt**, gồm payload/header, parser, loại phần thought, phản hồi bị chặn/dở dang, JSON sai, citation và fallback. Kiểm tra giao diện mẫu trên Edge đã đạt ở bước 8; giao diện không đổi trong lần thay provider. Các kiểm thử model dùng phản hồi giả lập, không gọi API thật.

Citation tồn tại và JSON đúng **không chứng minh model diễn giải đúng nguồn**. Chế độ AI vẫn cần người đọc đối chiếu nội dung; chưa có bộ kiểm chứng ngữ nghĩa hoặc benchmark chẩn đoán. Nguồn đều là tự soạn, không được coi là hướng dẫn bảo trì thật. Tìm kiếm có thể chọn tài liệu chưa sát câu hỏi; template chỉ trích nguồn, không cam kết đã trả lời câu hỏi đầy đủ.

Kiểm thử tự động không gọi API thật: dùng phản hồi giả để kiểm tra payload, parser, citation sai, lỗi model, fallback, phân quyền, CSRF và revision/quyền thay đổi trong lúc chờ. Edge chạy mode template để kiểm tra giao diện, mở nguồn và mobile. Model thật cần cấu hình key/model trước khi nghiệm thu nhánh Gemini.
