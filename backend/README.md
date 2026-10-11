# Backend SmartMaint — API cho bản demo

Tình trạng hiện tại: [bàn giao demo](../docs/guides/DEMO-HANDOVER.md). Xem [README dự án](../README.md) để cài trên máy mới. Dùng `Cai-dat-demo.cmd` rồi `Chay-demo.cmd`; máy chủ mặc định ở cổng 8001. Các mô tả theo số bước bên dưới ghi lại quá trình triển khai trước đây.

RAG hiện có [Gemini Embedding + sqlite-vec + Gemini](../docs/guides/DENSO-RAG-VECTOR-GEMINI.md). Ứng dụng đọc `.env`; cần điền GEMINI_API_KEY để dùng API thật. `Chay-demo.cmd` chuẩn bị chỉ mục khi có key; `py -m backend.rag.check` kiểm tra live rõ ràng. Các ghi chú bước 6–9 bên dưới mô tả chế độ demo từ khóa/mẫu trước khi bổ sung vector.

Trang chính `/` giữ giao diện SmartMaint gốc. Tổng quan, hồ sơ công việc, hỗ trợ/xác nhận, hồ sơ tham gia, đề xuất/kiểm duyệt và kho tri thức đã dùng API/SQLite theo quyền. PM và thông báo prototype còn mô phỏng. Hồ sơ cũ trong localStorage được giữ riêng để xem/nhập, không tự đồng bộ sang database. Workspace độc lập được giữ tại `/workspace`. Dùng `py -m backend.tools.browser_smoke --original-ui` để kiểm tra giao diện tích hợp trên DB riêng.

Bổ sung [4 hồ sơ CNC và 6 tài liệu tra cứu mẫu](../docs/guides/DENSO-DEMO-SAMPLE-DATA.md). Lệnh `py -m backend.manage add-samples` thêm hồ sơ vào DB đã init-demo, không ghi đè hồ sơ hiện có. Bộ nguồn tra cứu tổng cộng 14 tài liệu.

Demo hiện bắt đầu bằng **Chọn vai trò → Vào hệ thống**, không cần mật khẩu. Người bảo trì dùng tài khoản mẫu `minh`, chuyên gia dùng `hai`, chuyên gia trưởng dùng `anh`. Quyền và dữ liệu hiện có được giữ nguyên; `anh` chưa được cấp hồ sơ BM-26028. Nút **Đổi vai trò** quay về màn hình chọn. Mỗi lần tải trang sẽ hiện màn hình chọn vai trò.

Để bật lại màn hình đăng nhập mật khẩu, đặt `$env:SMARTMAINT_DEMO_ROLE_SELECTION='0'` trước khi khởi động backend. Chế độ chọn vai trò không cần mật khẩu chỉ dành cho demo local; khi tắt, API chọn vai trò trả 404. Mật khẩu cũ không bị thay đổi.

Bước 9: [báo cáo 10 câu hỏi và kịch bản demo 5 phút](../docs/history/DENSO-STEP9-DEMO-REVIEW.md). Chạy `py -m backend.tools.demo_check` để kiểm tra lại chế độ mẫu qua API trên DB riêng; không gọi Gemini và không sửa dữ liệu hiện có.

Bước 8 thêm **Trả lời từ nguồn**: mặc định trích tài liệu theo mẫu, chưa dùng AI. Có adapter Gemini tùy chọn qua biến môi trường; chưa có cấu hình model thật trong môi trường hiện tại. Xem [hướng dẫn và giới hạn bước 8](../docs/history/DENSO-STEP8-ANSWERS.md).

**Ưu tiên hiện tại: demo đơn giản.** Giữ SQLite, dữ liệu mẫu và HozenDX mock; chưa cần PostgreSQL, SSO hoặc tích hợp thật. Xem [phạm vi và thứ tự làm tiếp cho demo](../docs/history/DENSO-DEMO-PLAN.md). Luồng chính dùng hồ sơ CNC có sẵn; các trường bổ sung được thu gọn.

Bước 7 có ô **Tra cứu tài liệu CNC mẫu** trong hồ sơ: tìm từ khóa trên bộ nguồn mô phỏng, đọc đoạn trích và mở toàn bộ tài liệu đúng phiên bản. Xem [hướng dẫn/API tra cứu](../docs/history/DENSO-STEP7-SEARCH.md). Chưa dùng LLM.

Backend demo CNC có quyền theo máy/hồ sơ, adapter HozenDX mock, dữ liệu có phiên bản, nhật ký nhiều đợt, báo cáo và tri thức được duyệt. RAG hiện có Gemini và vector tùy cấu hình; chưa có kết nối HozenDX/AIHO thật. Chi tiết schema ban đầu và migration tại [mô hình dữ liệu](../docs/design/DENSO-STEP5-DATA-MODEL.md); luồng hiện tại nằm trong tài liệu bàn giao.

## Chạy trên Windows / PowerShell

Chạy trong `D:\demo\demo`. Máy hiện tại dùng `py` (lệnh `python` trỏ tới alias Microsoft Store).

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m backend.manage init-demo
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Nếu dùng các thư viện Python đã có sẵn trên máy, có thể chạy trực tiếp:

```powershell
py -m backend.manage init-demo
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Lệnh `init-demo` in mật khẩu ngẫu nhiên của từng tài khoản mới **một lần**; giữ lại trước khi đóng terminal. Lệnh chạy lại không đổi mật khẩu/ghi đè dữ liệu. Mật khẩu trong DB là PBKDF2-SHA256 có salt riêng, 600.000 vòng; không có mật khẩu mặc định hoặc API tự đăng ký/tự cấp quyền.

Nếu quên mật khẩu demo, chạy tại máy có quyền đọc DB:

```powershell
py -m backend.manage reset-demo-password --username minh
```

Lệnh này in mật khẩu mới, thu hồi phiên cũ của đúng tài khoản và giữ nguyên hồ sơ/quyền. Có thể chọn một trong các username demo trong bảng dưới; đây không phải API đặt lại mật khẩu công khai.

- Workspace kết nối backend: <http://127.0.0.1:8000/>
- Prototype cũ độc lập/localStorage: <http://127.0.0.1:8000/prototype-demo>
- OpenAPI: <http://127.0.0.1:8000/docs>

Không chạy `http.server` tại project root để phục vụ backend: cần API FastAPI và allowlist file, không công khai thư mục DB/fixture.

## Tài khoản và quyền demo

| Tài khoản | Vai trò | Máy CNC-04 | Case BM-26028 | Sửa bối cảnh |
|---|---|---|---|---|
| minh | Người bảo trì | Có | Chủ hồ sơ | Có nếu công việc chưa kết thúc |
| hai | Chuyên gia | Có | Người tham gia | Không |
| anh | Chuyên gia trưởng | Có | Không được cấp | Không |
| nam | Chuyên gia | Có | Không tham gia | Không |
| lan | Người bảo trì | Không được cấp CNC | Không | Không |

Đây là phân quyền **seed riêng cho backend demo**, không suy ra quyền thật từ tài khoản prototype. Quyền được đọc từ DB mỗi request; biết caseId hoặc thay role ở trình duyệt không cấp quyền. Chuyên gia trưởng không mặc định đọc mọi case. Tài khoản minh có thể tạo hồ sơ BM mới khi xác nhận máy demo, nêu lý do nếu máy đã có hồ sơ mở. PM tạo mới, quản trị người dùng/quyền và SSO chưa nằm trong bước 4.

## API

| API | Điều kiện |
|---|---|
| `GET /api/health` | Công khai; chỉ trạng thái demo |
| `POST /api/auth/login` | Tài khoản/mật khẩu, không nhận role/userId để cấp quyền |
| `GET /api/auth/me` | Session hợp lệ; trả danh tính/quyền và CSRF token |
| `POST /api/auth/logout` | Session + `X-CSRF-Token`; thu hồi session ở server |
| `GET /api/assets` | Session; chỉ máy được cấp quyền |
| `GET /api/integration/hozendx/assets/{assetId}` | Session + quyền máy; fixture mock, không kết nối nhà máy |
| `GET /api/cases` | Session + quyền máy + tham gia hồ sơ + vai trò phù hợp |
| `GET /api/cases/{id}` | Điều kiện như trên; không lộ hồ sơ ngoài phạm vi |
| `POST /api/cases` | maintenance + quyền máy + CSRF + Idempotency-Key + xác nhận máy demo |
| `PUT /api/cases/{id}/context` | Chủ hồ sơ maintenance + CSRF + Idempotency-Key + đúng hai revision |

`ContextUpdate` cần `expectedContextRevision`, `expectedCaseDataRevision`, `context`. Schema context gồm symptom và các trường Alarm/bộ phận/chế độ/model sản phẩm/tốc độ/ca/thời điểm/môi trường/5M1E; không chấp nhận trường role/owner/machineState để sửa quyền hoặc trạng thái bằng đường này.

Session là token ngẫu nhiên trong cookie HttpOnly/SameSite=Strict; server chỉ lưu hash token, hết hạn sau 8 giờ. CSRF token lưu trong bộ nhớ giao diện; mutations phải gửi header đúng session, và Origin trình duyệt phải cùng origin. Logout thu hồi token, không chỉ xóa cookie. Nếu triển khai HTTPS đặt `SMARTMAINT_SECURE_COOKIE=1` để bật Secure; hiện chỉ chạy local demo, chưa cấu hình vận hành nhà máy. Không bật CORS rộng hoặc lưu token đăng nhập trong localStorage.

Idempotency key có phạm vi người dùng, gắn loại thao tác/đối tượng/payload; cùng key/payload trả cùng kết quả, khác payload trả 409. Ghi nghiệp vụ/audit/kết quả thao tác trong cùng transaction SQLite. Replay cũng kiểm tra quyền hiện tại. Sau replay UI đọc lại bản server vì dữ liệu có thể đã tiến lên revision khác. Kho operation hiện giữ toàn bộ cho demo; dọn dữ liệu/lưu trữ theo chính sách khi triển khai thật.

## Dữ liệu và giới hạn bước này

DB mặc định `.runtime/smartmaint.sqlite3`, có thể đổi bằng `SMARTMAINT_DB`. File DB/phiên/password hash không được phục vụ qua static route. Hồ sơ localStorage chỉ chuyển sang database khi người dùng chọn nhập; các màn hình BM và tri thức hiện dùng chung backend.

Case seed là snapshot demo dựa trên BM-26028. Nhật ký hỗ trợ thêm/đính chính theo revision và xem lịch sử. Chủ hồ sơ mở/kết thúc đợt; chuyên gia xác nhận nhóm ghi nhận mình thực hiện. Bối cảnh có phiên bản; trạng thái máy/công việc/báo cáo riêng biệt. Đã có luồng báo cáo, đề xuất, duyệt độc lập và xuất bản tri thức vào RAG. Database nghiệp vụ dùng SQLite, vector dùng sqlite-vec; chưa triển khai PostgreSQL/pgvector.

DB cũ tự migration khi chạy backend; có backup trước nâng cấp nếu có hồ sơ. Có thể chạy `py -m backend.manage migrate` để xem version và đường dẫn backup. Migration giữ tài khoản, mật khẩu, audit và dữ liệu cũ. Xem quy tắc và API bổ sung trong tài liệu bước 5.

Workspace bảo vệ nội dung chưa lưu khi chuyển panel/tải lại; lưu chỉ hiện thành công sau API xác nhận. Phiên hết hạn giữ DOM đang nhập trong tab và yêu cầu đăng nhập lại; chỉ phục hồi khi cùng user, server vẫn kiểm tra revision/quyền. Đây chưa phải chế độ offline. Xung đột 409 giữ bản đang nhập; người dùng sao chép phần cần giữ rồi tải bản server để đối chiếu, chưa có giao diện merge tự động.

Pilot thật cần SSO hoặc quản lý tài khoản được vận hành, HTTPS, phạm vi quyền thực tế, dữ liệu được duyệt, migration/backup và cấu hình tích hợp đã xác minh. Bước này là nền local demo, không xác nhận sẵn sàng production.

## Kiểm thử

```powershell
py -m pip install -r backend/requirements-dev.txt
py -m pytest backend/tests -q
```

Kiểm thử trình duyệt tùy chọn trên Windows có Edge:

```powershell
py -m backend.tools.browser_smoke
```

Lệnh này tự chạy backend tạm và Edge headless, dùng DB/profile riêng trong `.runtime/browser-smoke-*`; kiểm tra luồng đăng nhập, lưu, phục hồi phiên, tạo hồ sơ và phân quyền, rồi dừng hai process. Screenshot lưu cùng thư mục. Không dùng hoặc đổi dữ liệu demo mặc định. Có thể cấu hình đường dẫn Edge bằng `SMARTMAINT_EDGE`.

Bộ test dùng SQLite tạm và TestClient, kiểm tra quyền, session/thu hồi, cookie/CSRF, revision, chống gửi lặp, snapshot, persistence và file private. Theo [tài liệu FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/), TestClient gọi ứng dụng ASGI trực tiếp; cần thêm kiểm tra chạy HTTP/browser thực tế để đánh giá giao diện đầy đủ.

## Database từ xa cho demo miễn phí

Mặc định `SMARTMAINT_STORAGE=sqlite`. Khi đặt `SMARTMAINT_STORAGE=turso`, `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN`, các module nghiệp vụ dùng `store.connect` → adapter libSQL HTTP v2. Không fallback ghi vào file tạm. Database remote mới được seed một lần; database hiện có phải ở schema v5. SQLite local vẫn dùng migration/backup cũ.

Chạy `python -m backend.tools.check_storage` để đọc trạng thái kết nối/schema và đếm dữ liệu. `export_cases` vẫn là công cụ SQLite local. Vector index vẫn là cache sqlite-vec local và có thể tạo lại từ nguồn đã xuất bản. Hướng dẫn: [Live Demo miễn phí](../docs/guides/LIVE-DEMO-DEPLOYMENT.md).
