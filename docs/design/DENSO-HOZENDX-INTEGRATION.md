# Bước 3 — Chuẩn bị tích hợp HozenDX

Ngày: 09/10/2026. Người dùng chọn **chuẩn bị bảng câu hỏi và phương án mock trước**, sau đó cung cấp các ảnh thông tin về hệ thống hiện hữu, gồm ảnh bổ sung mô tả HozenDX và chatbot AIHO ở “Câu số 1”.

## 1. Kết luận hiện tại

Thông tin trực tiếp từ các ảnh người dùng cung cấp:

| Nguồn | Nội dung quan sát được | Phạm vi xác nhận |
|---|---|---|
| Ảnh câu 12 | “Denso có HzenDX là hệ thống quản lý thiết bị, lý lịch thiết bị.” | Theo trích đoạn, có hệ thống quản lý thiết bị và lý lịch thiết bị |
| Ảnh câu 16 | “Có, sử dụng hệ thống HozenDX, truy cứu nhanh chatbot Hozen” | Theo trích đoạn, có sử dụng HozenDX và chatbot Hozen để truy cứu nhanh |
| Ảnh bổ sung “Câu số 1” | HozenDX và chatbot AIHO hỗ trợ nhân viên bảo dưỡng tra cứu thông tin thiết bị để điều tra nguyên nhân và xử lý sự cố | Mô tả cụ thể các nhóm thông tin có thể tra cứu; xem phần 3 |

Ảnh 12 viết `HzenDX`, các ảnh sau viết `HozenDX`; tài liệu dùng tên HozenDX theo ngữ cảnh. Ảnh câu 16 gọi chatbot Hozen, ảnh bổ sung gọi chatbot AIHO. Chưa biết hai tên chatbot là cùng sản phẩm hay hai công cụ khác nhau; thiết kế không phụ thuộc giả định đó. Chưa có tài liệu kỹ thuật hoặc toàn bộ Q&A.

Ảnh bổ sung đã mô tả khả năng tra cứu lịch sử BM, sửa chữa, kết quả PM, SOP/DAS, cấu trúc/linh kiện, bản vẽ, cải tạo và tồn kho. Đây là bằng chứng nghiệp vụ do người dùng cung cấp; chưa phải kiểm thử truy cập thực tế hoặc xác nhận mỗi máy CNC có đủ mọi nhóm dữ liệu. Ảnh chưa xác nhận API, xuất file, tải toàn văn, định dạng, quyền đưa dữ liệu vào RAG hoặc tình trạng duyệt của từng tài liệu/case.

Chưa xác minh API, endpoint, định dạng xuất, cơ chế xác thực, quyền, tần suất cập nhật hoặc môi trường thử nghiệm HozenDX. Khả năng tra cứu nghiệp vụ được mô tả trong ảnh không tự chứng minh khả năng kết nối từ SmartMaint. Không có kết nối thật hoặc thao tác gửi dữ liệu sang HozenDX trong bước này.

HozenDX/chatbot AIHO đã được mô tả là hỗ trợ tra cứu phục vụ điều tra và xử lý sự cố. Vì vậy không định vị giá trị SmartMaint chỉ ở việc “có chatbot/tìm ca tương tự”. Trọng tâm thiết kế là giữ bối cảnh ca xuyên nhiều đợt, ghi nhận bước đã thử và bằng chứng, xác nhận đóng góp, kiểm duyệt và tái sử dụng tri thức có phiên bản. Chưa đủ thông tin để kết luận các chức năng này thiếu ở hệ thống hiện hữu. Không mặc định chatbot có API, dùng RAG hoặc cho phép truy cập kho phía sau.

Đầu ra đã chuẩn bị:

- [Bảng câu hỏi và trạng thái xác minh](../data/inventory/HOZENDX-VERIFICATION.csv) để người dùng làm việc với đầu mối IT/HozenDX.
- [Mock dữ liệu máy CNC](../../fixtures/hozendx/cnc-04.mock.json) cho việc phát triển backend ở bước sau.
- Hợp đồng nội bộ và quy tắc lỗi/nguồn dưới đây. Đây là đề xuất của SmartMaint, không phải đặc tả API HozenDX.

## 2. Phương án kết nối

| Phương án | Điều kiện chọn | Tình trạng hiện tại |
|---|---|---|
| Mock adapter | Chưa có dữ liệu/API; dùng để phát triển luồng | Chọn cho giai đoạn hiện tại; mới có fixture, chưa có adapter chạy |
| File-import adapter | Có file xuất được cấp quyền và định dạng được xác nhận | Chưa xác minh; nhập có kiểm soát ở backend, không thêm import file vào màn hình chuyên gia MVP |
| API adapter | Có tài liệu, sandbox, quyền và kênh mạng được cấp | Chưa xác minh |

Backend sử dụng một hợp đồng nội bộ để có thể thay adapter. Không cần giả lập endpoint bên ngoài hoặc phụ thuộc tên bảng/schema chưa biết của HozenDX. Mỗi adapter phải giữ nguồn, thời điểm, phiên bản, môi trường và quyền của dữ liệu.

## 3. Phạm vi đọc ưu tiên cho CNC

Theo ảnh “Câu số 1”, các nhóm thông tin có thể tra cứu qua hệ thống hiện hữu gồm:

| Nhóm thông tin được mô tả | Ánh xạ dự kiến cho SmartMaint |
|---|---|
| Lý lịch: maker, model, năm lắp đặt, thông số kỹ thuật | Metadata máy; phân biệt năm lắp đặt với năm chế tạo hoặc trường year chưa rõ nghĩa trong demo |
| Cấu trúc thiết bị và danh mục linh kiện; chế độ bảo dưỡng | Bối cảnh bộ phận, cấu trúc và cơ sở cấu hình checklist |
| Lịch sử hỏng hóc BM | Case tham chiếu, cần kiểm tra trạng thái và bằng chứng |
| Nội dung sửa chữa và biện pháp đã thực hiện | Hành động/kết quả lịch sử; không tự suy ra hiệu quả với ca hiện tại |
| Kết quả PM và điểm bất thường | Quan sát/số đo/kết quả kiểm tra khi thực sự được cung cấp |
| SOP, DAS, tiêu chuẩn bảo dưỡng | Tài liệu nguồn cần kiểm tra phiên bản, hiệu lực, toàn văn và quyền |
| Bản vẽ điện và cơ khí | Tham chiếu theo bản vẽ/revision; có thể cần xử lý hình ảnh riêng ở giai đoạn sau |
| Hồ sơ cải tạo/thay đổi thiết bị | Đối chiếu cấu hình và điểm thay đổi; không mặc định lịch sử đầy đủ |
| Danh sách linh kiện và tồn kho liên quan | Tham chiếu có thời điểm; không coi là tồn kho thời gian thực hoặc quyết định thay linh kiện |

Ví dụ Vision trong ảnh còn nêu tra cứu BM tương tự, nguyên nhân gốc đã xác nhận, linh kiện thay, ảnh trước/sau sửa, bản vẽ đấu nối camera và chu kỳ thay thế. Đây là ví dụ Vision được mô tả, không phải bộ dữ liệu CNC đã nhận hoặc bảo đảm mọi BM đều có nguyên nhân xác nhận. Phạm vi MVP tiếp tục là CNC rung/nhiệt độ theo lựa chọn người dùng.

Ưu tiên tích hợp lần đầu vẫn giới hạn ở các nhóm sau; không cần đưa toàn bộ khả năng nêu trên vào MVP:

| Dữ liệu | Mục đích | Quy tắc |
|---|---|---|
| Mã máy, model máy, nhà chế tạo, line | Xác minh đúng máy khi mở hồ sơ | Đối chiếu định danh thực tế; không tự coi CNC-04 demo là máy thật |
| Lịch sử BM/PM | Bối cảnh và lần thử trước | Hồ sơ thô chưa tự trở thành tri thức dùng chung |
| SOP/manual/tiêu chuẩn | Tham chiếu đúng phiên bản và phạm vi | Có toàn văn/quyền/phê duyệt mới đánh giá khả năng làm nguồn RAG |
| Checklist hoặc chế độ PM | Điền mẫu có nguồn | Không tự suy ra lịch, phân công hay kết quả đã thực hiện |
| Cấu trúc/linh kiện/cải tạo | Bổ sung bối cảnh khi cần | Chỉ lấy khi được cung cấp và có quyền |

Danh sách linh kiện/tồn kho đã được ảnh mô tả là có thể tra cứu. Tuy nhiên lịch/phân công PM, cảnh báo/trạng thái máy tức thời, độ mới tồn kho và ghi báo cáo trở lại vẫn chưa được xác nhận. MVP mock không phụ thuộc các chức năng này.

## 4. Hợp đồng nội bộ đề xuất

Các phương thức logic cho backend: `getAsset(assetId, accessContext)`, `listMaintenanceHistory(assetId, cursor, accessContext)`, `listDocumentReferences(assetId, accessContext)`, `getPmTemplate(assetId, accessContext)`. Đây không phải các URL HozenDX. Việc tải toàn văn có thể bổ sung khi quyền và phương thức truy cập tài liệu được xác minh.

Envelope kết quả gồm:

| Trường | Ý nghĩa |
|---|---|
| `contractVersion` | Phiên bản hợp đồng nội bộ của SmartMaint |
| `environment`, `adapterMode`, `isSimulated` | Phân biệt demo/production và mock/file/api |
| `status` | ok / partial / not_found / forbidden / unavailable / invalid_data |
| `provenance.sourceSystem`, `sourceRecordId` | Nguồn và định danh bản ghi; mock không được ghi như kết nối thật |
| `provenance.sourceVersion` | Phiên bản nguồn; null khi chưa biết, không tự tạo version nhà cung cấp |
| `provenance.sourceUpdatedAt` | Thời điểm cập nhật tại nguồn, null nếu không được cung cấp |
| `provenance.acquiredAt`, `acquisitionMethod` | Thời điểm lấy/nhập bản này và cách lấy; không thay cho thời điểm cập nhật nguồn |
| `capabilities` | Quyền/khả năng thực sự đã xác minh; unknown không có nghĩa supported |
| `data` | Metadata máy, lịch sử, tham chiếu và checklist có định danh riêng |
| `warnings` | Phần thiếu, dữ liệu cũ, summary-only hoặc giới hạn nguồn |

Các bản ghi lịch sử/tài liệu/checklist giữ ID, version và thông tin nguồn riêng khi có. Model sản phẩm thuộc bối cảnh ca, không nhập vào `asset.machineModel`. Giá trị không biết giữ null hoặc unknown theo schema; không ghi 0 hoặc chuỗi trống để biểu diễn số đo chưa có.

`accessContext` được backend tạo từ danh tính và quyền đã xác minh; trình duyệt không tự cấp plant scope. Adapter kiểm tra quyền trước khi đọc cache/nguồn; kết quả được lọc lại trước trả về UI hoặc dùng trong prompt.

## 5. Quy tắc dùng mock

Fixture CNC-04 lấy các thông tin mô phỏng từ seed hiện tại: model MC-400, lịch sử HZ-BM-0786, summary SOP-CNC-04 và checklist PM-CNC-01. Fixture không chứa nguồn nhiệt độ đã duyệt, thông số đo, ngưỡng kỹ thuật hoặc quy trình sửa được tạo thêm.

- Hiển thị “HozenDX mô phỏng — chưa kết nối” và “Chưa đồng bộ”, không hiển thị đã đồng bộ thành công.
- Chỉ người thử nghiệm xác nhận đúng máy demo mới mở luồng demo. Pilot thật cần xác minh máy/quyền/dữ liệu thật.
- Metadata/tham chiếu mock không được đưa vào index production. SOP summary không đủ để sinh thao tác hoặc ngưỡng.
- Không tự ghi đè quan sát hiện trường từ trạng thái nguồn; riêng CNC-04 chưa có tình trạng máy hiện tại được xác minh.
- `capabilities.*=unknown` cho khả năng nhà cung cấp chưa rõ; `writeBackEnabled=false` cho adapter mock. Đây không phải kết luận HozenDX không hỗ trợ ghi.

## 6. Lỗi, độ cũ và đồng bộ

| Tình huống | Cách xử lý đề xuất |
|---|---|
| Không tìm thấy máy | Không tạo hồ sơ gắn máy chưa xác minh; giữ nội dung đã nhập |
| Không có quyền | Không trả dữ liệu/cache; không dùng bản cũ để vượt quyền |
| Timeout/kết nối lỗi | Hiện lỗi; chỉ dùng snapshot dự phòng nếu quyền hiện tại hợp lệ, dữ liệu đủ dùng và người dùng xác nhận |
| Không biết độ mới | Hiện “Chưa xác minh thời điểm nguồn”; không gọi là dữ liệu mới nhất |
| Dữ liệu thiếu/sai định dạng | Gắn partial/invalid_data; không tự điền model, kết quả hoặc ngưỡng |
| Không có lịch PM | Dùng checklist đã cấu hình/được cấp; không tự tạo lịch tích hợp |
| Nguồn khác hiện trường | Hiển thị cả hai kèm thời điểm/người ghi để xác minh, không ghi đè âm thầm |

Chưa đặt chu kỳ polling, TTL hoặc ngưỡng độ cũ khi chưa biết dữ liệu và yêu cầu nghiệp vụ. Sẽ thống nhất theo từng loại nguồn; cache không thay thế kiểm tra quyền hoặc hiệu lực. Timeout/retry API thật phải tuân theo rate limit được cấp; dùng backoff cho lỗi tạm thời, không lặp vô hạn khi forbidden hoặc dữ liệu sai.

Ghi trả báo cáo là giai đoạn sau. Chỉ thiết kế/triển khai khi có API và quyền rõ ràng; lưu báo cáo SmartMaint bền vững trước, job có idempotency key, lỗi giữ hàng chờ và không đảo trạng thái báo cáo. LLM không có quyền tự gửi HozenDX.

## 7. Kiểm tra khi có thông tin thật

Ba câu hỏi ưu tiên từ mức thông tin hiện có: (1) Có thể xuất danh sách/lý lịch máy và tài liệu/case được phép dùng không? (2) Có đầu mối quản lý HozenDX/chatbot Hozen hoặc AIHO để làm rõ cách truy cập không? (3) Dữ liệu nào được phép đưa vào prototype/RAG? Bảng câu hỏi kỹ thuật tiếp tục dùng khi làm việc được với đầu mối, không phải điều kiện để tiếp tục phát triển mock. Bảng cũng ghi riêng các khả năng nghiệp vụ đã được mô tả trong ảnh; không đồng nhất với khả năng API đã xác minh.

1. Điền bảng xác minh bằng tài liệu hoặc phản hồi của đầu mối, ghi ngày và nơi có bằng chứng.
2. Chọn API hoặc file nhập theo khả năng được cấp; xác minh xác thực, quyền dữ liệu và sandbox.
3. Lấy một bản ghi máy và mẫu lịch sử/tài liệu/checklist được phép sử dụng; ánh xạ sang hợp đồng nội bộ.
4. Thử đúng quyền/sai quyền, không tìm thấy, dữ liệu thiếu, timeout, nguồn cũ, thu hồi quyền và phân trang.
5. Đối chiếu model/ID/version/thời gian với nguồn; chuyên gia xác nhận dữ liệu phù hợp trước pilot.

**Tiến độ bước 3:** hoàn thành chuẩn bị bảng hỏi, hợp đồng dự kiến và fixture mock theo lựa chọn người dùng. Chưa xác minh hoặc triển khai kết nối thật; mock chưa được nối vào giao diện. Có thể sang bước 4 xây backend/xác thực và adapter mock, giữ riêng điều kiện cần bổ sung trước pilot nhà máy.

**Cập nhật bước 4:** đã triển khai adapter mock phía backend và workspace API riêng, có kiểm tra quyền trước đọc dữ liệu. Xem [DENSO-STEP4-IMPLEMENTATION.md](../history/DENSO-STEP4-IMPLEMENTATION.md). Kết nối HozenDX thật vẫn chưa xác minh; prototype localStorage cũ không chuyển thành backend một cách tự động.
