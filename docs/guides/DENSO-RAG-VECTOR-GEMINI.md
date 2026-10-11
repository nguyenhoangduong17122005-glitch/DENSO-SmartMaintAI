# Demo RAG với Gemini Embedding, sqlite-vec và Gemini

Giao diện SmartMaint gốc được giữ nguyên. Mục **Hồ sơ CNC & tra cứu** dùng cùng các API hiện có, nhưng có lựa chọn tìm kiếm vector và trả lời bằng Gemini.

## Kích hoạt

1. Tạo API key tại [Google AI Studio](https://aistudio.google.com/api-keys).
2. Mở `.env` ở thư mục dự án. Điền key vào `GEMINI_API_KEY=` trên máy; không gửi key vào chat, không đưa vào JavaScript. Nếu vừa chạy `Cai-dat-demo.cmd`, đổi `SMARTMAINT_ANSWER_MODE=gemini` và `SMARTMAINT_RETRIEVAL_MODE=vector` vì cài đặt mới mặc định chạy offline. File này đã được .gitignore loại trừ. Các giá trị môi trường đã đặt trong Terminal được ưu tiên hơn `.env`.
3. Dừng máy chủ cũ bằng Ctrl+C trong cửa sổ đang chạy.
4. Nhấp đúp `Chay-demo.cmd`. Nếu chưa có chỉ mục hoặc nguồn/model đổi, launcher tạo embedding trước khi mở máy chủ. Khi chỉ mục không đổi, không gọi lại embedding cho tài liệu.
5. Vào **Hồ sơ CNC & tra cứu**, mở BM-26028. Dòng trạng thái cho biết chỉ mục đã sẵn sàng hay chưa và Gemini đã có cấu hình hay chưa.
6. Nhập câu hỏi, bấm **Tra cứu tài liệu** để gọi embedding câu hỏi và tìm vector. Bấm **Trả lời từ nguồn** để thực hiện truy xuất rồi gọi Gemini. Nhãn trên kết quả mới xác nhận chế độ đã thực sự dùng; có cấu hình không đồng nghĩa gọi thành công.

Chỉ mục có thể tạo riêng bằng `scripts/windows/Tao-chi-muc-RAG.cmd`, hoặc:

```powershell
py -m backend.rag.vectors
```

Kiểm tra kết nối thật, gồm tạo/tái sử dụng chỉ mục, một lần truy vấn vector và một lần Gemini trả lời:

```powershell
py -m backend.rag.check
```

Chạy lệnh này có gửi các tài liệu demo/câu hỏi tới Gemini và dùng hạn mức API. Thành công phải có `passed: true`, `retrieval: vector_search`, `answer: gemini`. Chưa có key thì không thể hoàn tất kiểm thử thật. Nếu lỗi HTTP embedding, kiểm tra quyền key, model và hạn mức; mã không in response chứa dữ liệu hoặc key.

## Cấu hình hiện tại

```dotenv
SMARTMAINT_ANSWER_MODE=gemini
SMARTMAINT_RETRIEVAL_MODE=vector
SMARTMAINT_GEMINI_MODEL=gemini-3.8-flash
SMARTMAINT_EMBEDDING_MODEL=gemini-embedding-001
SMARTMAINT_EMBEDDING_DIMENSIONS=768
SMARTMAINT_VECTOR_MIN_SCORE=0.45
GEMINI_API_KEY=
```

Đổi về chế độ offline bằng `SMARTMAINT_RETRIEVAL_MODE=keyword` và `SMARTMAINT_ANSWER_MODE=template`, rồi khởi động lại máy chủ. Không đặt key vào `.env.example`.

## File và dữ liệu

| Thành phần | Vị trí |
|---|---|
| Hồ sơ / nhật ký SQLite hiện có | `.runtime/smartmaint.sqlite3` |
| Chỉ mục vector riêng | `.runtime/rag-vectors.sqlite3` |
| Tài liệu được lập chỉ mục | `fixtures/rag/cnc-demo-sources.json` |
| Gemini embedding, chỉ mục và cosine KNN | `backend/rag/vectors.py` |
| Chọn vector hoặc từ khóa dự phòng, lọc quyền | `backend/rag/search.py` |
| Gemini trả lời với schema và kiểm tra dẫn chứng | `backend/rag/answers.py` |
| Đọc .env | `backend/config.py` |

Kho vector có bảng `chunks` (nguồn, phiên bản, mục, nội dung), `index_meta` (hash bộ nguồn, model, kích thước, phiên bản cấu trúc), và bảng ảo `vectors` của sqlite-vec. Trình xem SQLite thông thường có thể đọc chunks/index_meta; truy vấn bảng ảo vectors cần nạp extension sqlite-vec. Không sửa chỉ mục thủ công; tạo lại từ nguồn bằng lệnh ở trên.

## Luồng xử lý

Mỗi mục tài liệu là một đoạn; bộ hiện có 14 tài liệu/29 đoạn ngắn. Đầu vào embedding gồm tiêu đề, từ khóa, tiêu đề mục và nội dung. Gemini Embedding dùng RETRIEVAL_DOCUMENT khi lập chỉ mục, RETRIEVAL_QUERY khi hỏi; các vector được chuẩn hóa. SQLite-vec thực hiện KNN theo khoảng cách cosine trong phạm vi asset/model. Kết quả gộp theo tài liệu, giữ tối đa 5 nguồn; khi trả lời, lấy đầy đủ các mục của 3 nguồn đầu để giữ cả giới hạn áp dụng.

Việc tạo chỉ mục thực hiện theo batch tối đa 10 đoạn, sau đó thay thế trong một transaction. Nếu gọi API lỗi, chỉ mục cũ được giữ nguyên. Thay đổi corpus/model/kích thước vector khiến chỉ mục cũ bị từ chối cho đến khi tạo lại. Chỉ mục đọc nguồn được chọn cho demo, không đọc bảng users, sessions, mật khẩu hoặc toàn bộ hồ sơ.

Quyền máy/hồ sơ được kiểm tra trước truy xuất; sau mạng được kiểm tra lại phiên, quyền, revision và hash nguồn. Không giữ transaction hồ sơ trong khi gọi API. Đầu ra Gemini phải đúng schema và chỉ dùng mã dẫn chứng trong nguồn đã truy xuất. Kiểm tra này không đảm bảo mọi nhận định đều đúng ngữ nghĩa; vẫn cần đọc nguồn và đánh giá chất lượng bằng dữ liệu thực tế.

Ngưỡng cosine 0.45 là giá trị khởi đầu cho demo, chưa được hiệu chỉnh bằng bộ câu hỏi độc lập với embedding thật. Điểm tương đồng không phải xác suất chẩn đoán. Những câu ngoài phạm vi máy được chặn trước khi gửi embedding. Khi thiếu key, chỉ mục cũ hoặc lỗi provider, ứng dụng ghi rõ đang dùng từ khóa/trả lời mẫu dự phòng; không giả lập kết quả Gemini thành công.

Nhật ký mới và dữ liệu prototype trong localStorage chưa tự trở thành nguồn RAG. HozenDX vẫn là mock, các nguồn đều là mô phỏng. Cần thêm bước lựa chọn/duyệt nguồn trước khi lập chỉ mục dữ liệu nghiệp vụ thật.

## Kiểm thử

`py -m pytest backend/tests -q` và `py -m backend.tools.browser_smoke --original-ui` dùng chế độ offline, chỉ mục/DB riêng và provider giả để kiểm tra cơ chế. Các vector thử nghiệm không ghi vào chỉ mục của người dùng. Kiểm thử live chỉ thực hiện với `py -m backend.rag.check` hoặc thao tác ứng dụng khi có cấu hình hợp lệ.

## Tài liệu kỹ thuật đã đối chiếu

- [Gemini Embeddings API](https://ai.google.dev/api/embeddings)
- [Gemini Embedding 001](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001)
- [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash)
- [sqlite-vec Python](https://alexgarcia.xyz/sqlite-vec/python.html)
- [sqlite-vec vec0](https://alexgarcia.xyz/sqlite-vec/features/vec0.html)
