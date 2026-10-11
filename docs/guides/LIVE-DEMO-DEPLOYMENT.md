# Triển khai Live Demo

Repo: [DENSO_Knowledge_Graph](https://github.com/nguyenhoangduong17122005-glitch/DENSO_Knowledge_Graph).

**Tình trạng:** mã cấu hình đã được chuẩn bị; chưa có URL hosting được triển khai/xác minh. Không dùng một URL ví dụ làm link Live Demo trong README.

## Phương án phục vụ toàn bộ ứng dụng trên Render

`render.yaml` là phương án tùy chọn chạy Docker, phục vụ frontend và backend cùng origin, lưu SQLite/vector tại `/data`. Cách này dùng các API và cookie hiện có, không đi qua giới hạn thời gian proxy Netlify.

**Chi phí:** Render yêu cầu service có phí để gắn Persistent Disk. Blueprint có `plan: starter` và disk 1 GB; kiểm tra giá hiển thị trong dashboard trước khi tạo. Chưa có dịch vụ trả phí nào được tạo tự động. Không bỏ disk rồi coi dữ liệu là bền vững: filesystem mặc định của Render là tạm thời, có thể mất dữ liệu khi restart/deploy.

1. Đưa các file Docker, `backend/serve.py`, `backend/hosting.py`, README và ảnh chụp lên repo. Không đưa `.env`, `.runtime`, database hoặc API key.
2. Trong Render, chọn **New → Blueprint**, kết nối repo trên và kiểm tra cấu hình `render.yaml`.
3. Xác nhận chi phí/disk rồi tạo service nếu bạn chọn phương án này. Docker image tự cài thư viện và khởi tạo dữ liệu khi chạy lần đầu. Các lần sau giữ database trên disk.
4. Chờ build/deploy thành công; mở URL `https://<tên-thực-tế>.onrender.com` mà Render cấp. App tự nhận `RENDER_EXTERNAL_HOSTNAME`, chấp nhận đúng host đó và dùng origin HTTPS; cookie đặt Secure theo Blueprint.
5. Kiểm tra `/api/health` trả `status: ok`, chọn vai trò, tạo hồ sơ tên riêng, tải lại và restart service để kiểm tra hồ sơ vẫn còn.
6. Thử kịch bản BM → báo cáo → đề xuất → duyệt → xuất bản → tra cứu. Gemini chưa được bật trong cấu hình mặc định; demo dùng từ khóa/trả lời mẫu.
7. Khi muốn bật Gemini, thêm API key qua **Render → Environment**, không đưa vào repo. Đặt các biến dưới đây rồi deploy lại. Model có thể đổi theo quyền API key của bạn.

```dotenv
SMARTMAINT_ANSWER_MODE=gemini
SMARTMAINT_RETRIEVAL_MODE=vector
SMARTMAINT_GEMINI_MODEL=gemini-3.8-flash
SMARTMAINT_EMBEDDING_MODEL=gemini-embedding-001
SMARTMAINT_EMBEDDING_DIMENSIONS=768
SMARTMAINT_VECTOR_MIN_SCORE=0.45
GEMINI_API_KEY=
```

`GEMINI_API_KEY=` chỉ minh họa tên biến; điền giá trị trong dashboard. Gemini và embedding dùng hạn mức của chủ key. Bản demo cho phép chọn vai trò, nên chỉ đưa dữ liệu mô phỏng và chia sẻ cho nhóm thử nghiệm; cấu hình này chưa thay thế xác thực production.

8. Chỉ sau khi kiểm tra thành công, thay dòng **Live Demo: chưa xuất bản** đầu README bằng link URL thực tế. Không gắn `/api/health` thay cho URL giao diện.

### Domain riêng hoặc hosting Docker khác

Khởi chạy `python -m backend.serve`; nền tảng cung cấp `PORT`. Chạy một worker/instance với ổ dữ liệu gắn tại `/data`. Cấu hình:

```dotenv
SMARTMAINT_DB=/data/smartmaint.sqlite3
SMARTMAINT_VECTOR_DB=/data/rag-vectors.sqlite3
SMARTMAINT_ALLOWED_HOSTS=smartmaint.example.com
SMARTMAINT_PUBLIC_ORIGIN=https://smartmaint.example.com
SMARTMAINT_SECURE_COOKIE=1
```

Thay domain ví dụ bằng domain thực. Không dùng wildcard host/origin. Giữ backup SQLite bằng SQLite backup API; các backup migration nằm cạnh database trên disk.

## Nếu tiếp tục dùng frontend Netlify

Yêu cầu trước đó là frontend Netlify và backend riêng. Phương án này **chưa được xuất bản hoặc cấu hình đầy đủ** trong bản bàn giao hiện tại. Render ở trên là lựa chọn triển khai toàn bộ ứng dụng để có Live Demo cùng origin; không phải frontend đã được đưa lên Netlify.

Để dùng Netlify vẫn cần URL backend HTTPS, cấu hình proxy, kiểm tra cookie/CSRF và xử lý tác vụ Gemini/index dài. Proxy Netlify có giới hạn 26 giây, trong khi các tác vụ provider có thể lâu hơn; cần cơ chế chạy nền và polling trước khi coi toàn bộ RAG hoạt động ổn định qua proxy. Không chỉ upload thư mục `frontend` rồi coi database/RAG đã hoạt động.

## Kiểm tra đã thực hiện và giới hạn

Các bài kiểm thử Python kiểm tra hostname/origin HTTPS, cookie Secure, CSRF, chặn domain ngoài và khởi tạo dữ liệu lặp lại. Browser smoke kiểm tra giao diện trên database riêng và tạo ảnh thật cho README. Máy phát triển hiện chưa có Docker CLI, vì vậy chưa xác minh `docker compose build/up` trong môi trường Docker thực. Chưa kiểm tra URL live vì service chưa được tạo.

Workflow `.github/workflows/docker-smoke.yml` sẽ build/chạy Docker khi đẩy lên `main`, thử trả lời theo mẫu, tạo hồ sơ và kiểm tra hồ sơ còn sau restart. Xem kết quả trong tab **Actions** của repo; chỉ coi Docker được xác minh sau khi lần chạy tương ứng đạt. Workflow không dùng Gemini API key.

Tài liệu chính thức: [Docker Compose](https://docs.docker.com/reference/compose-file/services/), [Render Docker](https://render.com/docs/docker), [Render Blueprint](https://render.com/docs/blueprint-spec), [Render Persistent Disks](https://render.com/docs/disks), [Netlify proxy và giới hạn](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
