# Bước 9 — Kiểm tra và kịch bản trình bày demo

> Tài liệu lịch sử của giai đoạn trước. Trạng thái hiện tại: [bàn giao demo](../guides/DEMO-HANDOVER.md).

Ngày thực hiện: 10/10/2026, Asia/Bangkok. Phạm vi: CNC-04 / MC-400, dữ liệu mô phỏng, trả lời theo mẫu local. Không gọi Gemini trong lần kiểm tra này.

Kiểm tra hồi quy: **109 bài pytest đạt**. Edge browser smoke đạt các luồng đăng nhập, lưu, phục hồi phiên, tra cứu, trả lời mẫu, mở citation, mobile, nhật ký và xác nhận nhóm. Server đã nạp bản cập nhật tại <http://127.0.0.1:8001/>.

## Kết quả bộ 10 câu hỏi

Đã chạy cả 10 câu qua API đăng nhập → đọc hồ sơ → yêu cầu trả lời → mở nguồn bằng ASGI TestClient, dùng DB riêng. **10/10 đạt các kiểm tra tự động** về nguồn đứng đầu, trạng thái, citation, nguyên văn trích dẫn, nhãn mô phỏng và hồ sơ không đổi. Báo cáo JSON nằm ở `.runtime/reports/STEP9-DEMO-RESULTS.json` trên máy đã chạy kiểm tra; không đưa vào repo. Chạy `py -m backend.tools.demo_check` để tạo lại báo cáo, gồm câu hỏi, đáp án thực nhận, các checks và hash bộ nguồn.

| Câu | Nội dung | Nguồn đứng đầu | Trạng thái | Đối chiếu nội dung mẫu |
|---|---|---|---|---|
| Q01 | Model máy/model sản phẩm | DEMO-CNC-001 | reference_only | MC-400; phân biệt hai loại model; năm lắp đặt chưa xác minh |
| Q02 | Ghi gì khi rung vùng trục chính | DEMO-CNC-002 | reference_only | Vị trí, điều kiện, thời điểm, thay đổi; chỉ ghi số đo khi đã có |
| Q03 | Case rung sau thay đồ gá | DEMO-CNC-003 | reference_only | Có diễn biến, kết quả hư cấu và giới hạn so sánh; không coi là sửa chữa thật |
| Q04 | Rung gián đoạn, có phải thay cụm truyền động | DEMO-CNC-004 | insufficient_evidence | Chưa kết luận hoặc xác nhận phục hồi; không chứng minh cần thay linh kiện |
| Q05 | Nóng nhưng chưa đo | DEMO-CNC-005 | reference_only | Phân biệt nhận xét nóng và số đo; không tự tạo nhiệt độ |
| Q06 | Ngưỡng nhiệt độ cho phép | DEMO-CNC-005 | insufficient_evidence | Thiếu tiêu chuẩn đúng model/bộ phận; không đưa con số ngưỡng |
| Q07 | Nóng lâu có chắc thiếu bôi trơn | DEMO-CNC-006 | insufficient_evidence | Giữ giả thuyết chưa kiểm chứng; không hướng dẫn thêm/đổi dầu |
| Q08 | Có checklist PM thì đã đạt chưa | DEMO-CNC-007 | reference_only | Ba mục chưa có kết quả; không chứng minh PM đã làm hoặc đạt |
| Q09 | Camera máy Vision | Không có | no_match | Ngoài phạm vi CNC; không hướng dẫn sửa camera từ nguồn CNC |
| Q10 | Các bước tháo trục chính theo SOP | DEMO-CNC-008 | insufficient_evidence | SOP chỉ có tóm tắt; không tự tạo các bước tháo máy |

Đối chiếu trong bảng là đọc nội dung mẫu thực nhận, không phải xác nhận kỹ thuật của chuyên gia DENSO. `reference_only` là nguyên văn tài liệu tham khảo, không phải model đã tổng hợp câu trả lời. Các điểm trả lời và điều không được khẳng định vẫn cần đọc theo ngữ cảnh; không dùng so khớp từ đơn giản làm điểm chất lượng ngữ nghĩa.

## Điểm đã sửa

Ban đầu Q01/Q04 tìm được nguồn kỳ vọng trong danh sách nhưng chọn nguồn khác đứng đầu. Vì mẫu chỉ trích tài liệu đầu, có nguồn đúng trong top 5 chưa đủ. Đã bổ sung ưu tiên keyword/cụm từ khớp đầy đủ để giảm ảnh hưởng của các âm tiết tiếng Việt trùng nhau. Giữ nguyên bộ câu hỏi và nội dung nguồn; kiểm thử retrieval hiện kiểm tra nguồn đứng đầu.

Bộ 10 câu đã được dùng để chỉnh xếp hạng nên không phải benchmark độc lập. Không đưa đáp án kỳ vọng vào corpus, prompt hoặc xử lý theo mã Q01–Q10. Kết quả không chứng minh độ chính xác với mọi cách diễn đạt hoặc chất lượng của Gemini.

## Kịch bản trình bày khoảng 5 phút

| Thời gian | Thao tác | Điều nên nói |
|---|---|---|
| 0:00–0:30 | Đăng nhập bảo trì, mở BM-26028 | “Đây là demo CNC dùng nguồn mô phỏng; HozenDX đang là mock.” |
| 0:30–1:00 | Xem hiện tượng và các đợt có sẵn | “Một hồ sơ tiếp tục qua nhiều đợt. Nhật ký giữ người làm và người ghi.” |
| 1:00–2:00 | Nhập `rung sau thay đồ gá`, Tra cứu tài liệu, mở nguồn | “Tìm nguồn liên quan, giữ mã, phiên bản và mục trích dẫn.” |
| 2:00–2:45 | Nhấn Trả lời từ nguồn | “Buổi này dùng mẫu local, trích nguyên văn; nhãn chế độ nằm trong kết quả.” |
| 2:45–3:30 | Hỏi `Ngưỡng nhiệt độ cho phép của trục chính MC-400 là bao nhiêu độ C?` | “Chưa có tiêu chuẩn nên nêu thiếu bằng chứng, không tự đưa ngưỡng.” |
| 3:30–4:00 | Hỏi `Máy Vision không nhận sản phẩm, cần đấu lại camera thế nào?` | “Ngoài phạm vi nguồn CNC, chưa có kết quả phù hợp.” |
| 4:00–5:00 | Xem lịch sử nhật ký; tùy chọn mở đợt và ghi `Ghi nhận mô phỏng phục vụ trình bày, chưa có kiểm tra thực tế` | “Tra cứu không tự tạo việc đã làm hoặc kết luận sửa xong. Nhật ký do người dùng ghi.” |

Để không tạo thêm dữ liệu trong buổi trình bày, chỉ xem nhật ký có sẵn ở phút cuối. Có thể đổi sang tài khoản hai để minh họa chuyên gia nếu đã giữ mật khẩu; phần này là tùy chọn, không cần reset mật khẩu để hoàn thành kịch bản chính.

## Chuẩn bị và chạy lại

Mở backend đã nạp bản mã mới ở cổng 8001, dùng tài khoản hiện có. `/prototype-demo` là prototype localStorage riêng, không dùng để trình bày API mới. Mode template không cần mạng hoặc API key. Nếu quên mật khẩu, dùng hướng dẫn phục hồi trong README khi cần; lệnh đó thay mật khẩu và thu hồi phiên của tài khoản.

Khởi động bằng PowerShell trong thư mục dự án; nếu cổng đã có server của bạn, dừng bản cũ trước:

```powershell
$env:SMARTMAINT_ANSWER_MODE = 'template'
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Chạy lại kiểm tra:

```powershell
py -m backend.tools.demo_check
py -m pytest backend/tests -q
py -m backend.tools.browser_smoke
```

`demo_check` ép template, tạo DB riêng dưới `.runtime/demo-check-*`, gọi API qua TestClient và cập nhật JSON ở .runtime/reports. Không dùng hoặc thay đổi tài khoản/mật khẩu/hồ sơ của DB mặc định. Cần thư viện trong `backend/requirements-dev.txt`. Thời gian ghi trong JSON là in-process, không phải độ trễ HTTP hoặc Gemini.

Browser smoke chạy HTTP server và Edge với DB riêng, kiểm tra các luồng đăng nhập, lưu, phục hồi phiên, tra cứu, trả lời mẫu, mở nguồn, mobile, nhật ký, xác nhận nhóm và phân quyền. Kiểm thử Gemini bằng phản hồi giả chỉ chứng minh parser/citation/fallback, không chứng minh Gemini thật đã hoạt động.

## Trạng thái hoàn thành

Bước 9 hoàn thành cho **demo tìm kiếm và trả lời theo mẫu local**. Nhánh AI còn cần cấu hình GEMINI_API_KEY, SMARTMAINT_GEMINI_MODEL, mode gemini, khởi động lại server rồi chạy và đọc đối chiếu bộ câu hỏi. Khi có lần chạy đó mới đánh giá câu trả lời Gemini và gọi luồng đang chạy là RAG có LLM.

Chưa có dữ liệu sản xuất, kết nối HozenDX thật hoặc tiêu chuẩn kỹ thuật đã xác minh. Các phần này không thuộc phạm vi demo đơn giản đã chốt.
