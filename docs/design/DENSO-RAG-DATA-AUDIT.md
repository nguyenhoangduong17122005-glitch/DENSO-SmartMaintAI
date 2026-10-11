# Bước 2 — Kiểm kê nguồn CNC cho RAG

Cập nhật bước 6 cho phạm vi demo: đã soạn riêng [8 tài liệu CNC mô phỏng](../../fixtures/rag/README.md), không thay đổi 7 đối tượng kiểm kê cũ. Đây không phải nguồn thực tế nhận từ DENSO/HozenDX; số nguồn thật đủ điều kiện vẫn là 0.

Ngày kiểm kê: 09/10/2026. Phạm vi đã kiểm tra: mã nguồn và file trong `D:\demo\demo`. Chưa kiểm tra kho HozenDX, tài liệu bên ngoài workspace hoặc dữ liệu đã nhập riêng trong localStorage của trình duyệt.

Người dùng xác nhận **chưa có dữ liệu thực tế — chuẩn bị mẫu kiểm kê trước**. Đầu ra bước 2 hiện tại được giới hạn ở mẫu thu thập, hướng dẫn phân loại và kiểm kê demo. Việc xác minh nguồn thật là điều kiện cần hoàn thành sau này trước pilot nhà máy.

## 1. Kết quả hiện tại

Đã ghi nhận **7 nguồn/đối tượng CNC demo** trong [CNC-SOURCE-INVENTORY.csv](../data/inventory/CNC-SOURCE-INVENTORY.csv). Đây là kiểm kê theo đối tượng logic, không phải 7 file tài liệu thật.

| Nguồn | Kết luận sử dụng |
|---|---|
| `KN-031` v1 — rung bất thường | Nguồn tri thức đã published trong demo; dùng thử luồng RAG demo, không dùng cho sản xuất |
| `DP-027` v2 — nhiệt độ | Cần bổ sung, chưa duyệt; loại khỏi nguồn trả lời chung, dùng thử bộ lọc trạng thái |
| `SOP-CNC-04` v3.0 | Chỉ có summary mô phỏng; chưa đủ để tạo hướng dẫn thao tác |
| `HZ-BM-0786` | Tóm tắt lịch sử thô; không tự chuyển thành tri thức đã duyệt |
| `BM-26028` | Case còn chờ linh kiện, hai đợt, bốn sự kiện, báo cáo nháp; chỉ dùng bối cảnh ca theo quyền |
| `CNC-04` | Metadata máy demo; không suy ra đây là máy pilot thực tế |
| `PM-CNC-01` v1 | Checklist demo; không phải bằng chứng việc đã làm hoặc tiêu chuẩn thật |

**Nguồn thực tế đủ điều kiện đã xác minh: 0.** Chưa tìm thấy PDF/DOCX/XLSX tài liệu máy trong workspace tại thời điểm kiểm kê. Chưa có nguồn nhiệt độ được duyệt để trả lời chung. Nguồn rung demo cũng không có số đo, ngưỡng hoặc biện pháp sửa cụ thể.

Thông tin bổ sung: ảnh “Câu số 1” người dùng cung cấp mô tả HozenDX/chatbot AIHO có thể tra cứu các nhóm dữ liệu thiết bị, BM, sửa chữa, PM, SOP/DAS, bản vẽ, cải tạo và tồn kho. Đây là bằng chứng về khả năng nghiệp vụ được mô tả, chưa phải tài liệu/case CNC thực tế đã nhận. Vì vậy số nguồn CNC thật đủ điều kiện vẫn là 0; không tạo thêm dòng nguồn thật từ các nhóm dữ liệu được liệt kê trong ảnh.

Trạng thái trong CSV phản ánh dữ liệu seed của mã nguồn. Các nội dung người dùng đã sửa trên trình duyệt cần xuất dữ liệu riêng để đối chiếu; không mặc định giống seed.

## 2. Cách bổ sung dữ liệu thực tế

Dùng [CNC-REAL-SOURCES-TEMPLATE.csv](../data/templates/CNC-REAL-SOURCES-TEMPLATE.csv), một dòng cho mỗi nguồn/phiên bản. File hiện chỉ có tiêu đề cột để tránh trộn dữ liệu minh họa với nguồn thật.

| Trường | Nội dung cần ghi |
|---|---|
| `inventory_id` | Mã kiểm kê riêng, ví dụ REAL-001; không phải mã máy |
| `source_id`, `title` | Mã và tên tài liệu/case gốc; chưa có mã thì dùng mã tạm có ghi chú |
| `source_type` | knowledge / manual / sop / standard / case / raw_history / asset / pm_template |
| `environment` | production hoặc demo; bắt buộc phân biệt |
| `location` | Đường dẫn file hoặc định danh trong kho nội bộ; không ghi mật khẩu/token |
| `machine_family`, `asset_ids`, `machine_model` | CNC, mã máy và model MÁY áp dụng; chưa rõ ghi unknown, không suy ra từ tên file |
| `topic` | vibration / temperature / safety / pm / context; nhiều giá trị ngăn bằng dấu chấm phẩy |
| `version` | Phiên bản tài liệu hoặc revision báo cáo; không dùng ngày nhập thay thế |
| `approval_status`, `reviewer` | Trạng thái và người/đơn vị duyệt có bằng chứng; được giao duyệt chưa có nghĩa đã duyệt |
| `effective_from`, `effective_to` | Ngày hiệu lực/hết hiệu lực nếu được quy định; unknown nếu chưa xác minh, not_applicable nếu xác nhận không áp dụng |
| `access_scope` | Nhà máy/bộ phận/nhóm người được đọc và quyền dùng làm nguồn RAG |
| `content_completeness` | full_text / structured_content / summary_only / incomplete |
| `shared_rag_decision` | pending_review mặc định; chỉ đổi sau khi kiểm tra điều kiện ở mục 3 |
| `missing_information` | Các phần cần bổ sung, nguồn xác nhận và lý do chưa được nhập kho |

Không bắt buộc biết toàn bộ metadata ngay để bắt đầu kiểm kê. Ghi rõ unknown và giữ nguồn ở pending_review. Bảng kiểm kê lưu trong workspace không thay thế ACL của hệ thống khi triển khai.

## 3. Kiểm tra trước khi đưa vào kho trả lời chung

1. **Nguồn gốc:** mở được nội dung gốc, xác định chủ sở hữu và quyền sử dụng; dữ liệu demo được tách riêng.
2. **Phê duyệt:** có bằng chứng được duyệt dùng chung trong phạm vi tương ứng. Báo cáo confirmed vẫn cần duyệt tri thức; SOP/manual theo quy trình phê duyệt tài liệu của nhà máy.
3. **Phiên bản và hiệu lực:** xác định bản hiện hành, tài liệu thay thế/thu hồi; không mặc định bản mới nhất theo tên file là bản có hiệu lực.
4. **Phạm vi:** model máy, cụm/bộ phận, chế độ và điều kiện áp dụng được nêu rõ hoặc có phạm vi chung được xác nhận. Model sản phẩm ghi riêng khi liên quan.
5. **Chất lượng nội dung:** giữ đúng bảng, số, đơn vị, bước an toàn và giới hạn; summary không đủ để tái tạo phần toàn văn bị thiếu. Không tự điền số đo/tiêu chuẩn.
6. **Bằng chứng kết quả:** case nêu việc đã làm, kết quả, người thực hiện/xác nhận và phần chưa biết; tách giả thuyết khỏi nguyên nhân đã xác nhận. Case chưa khắc phục vẫn có thể được duyệt thành bài học với giới hạn rõ ràng.
7. **Quyền đọc:** xác định người được đọc trong pilot và nội dung cần ẩn; không đưa hồ sơ ngoài quyền vào prompt hoặc trích dẫn.

Quyết định sau kiểm tra: `eligible` (đủ điều kiện kho thật), `pending_review` (thiếu xác minh), `reference_only` (chỉ tham chiếu theo quyền), `case_context_only` (chỉ bối cảnh ca), `exclude_unapproved`, `exclude_incomplete`, hoặc `demo_eligible` (chỉ demo). Đủ điều kiện về dữ liệu chưa có nghĩa đã lập chỉ mục/sẵn sàng truy xuất.

## 4. Ưu tiên thu thập cho hai tình huống

| Ưu tiên | Nguồn cần tìm | Giá trị |
|---|---|---|
| 1 | Danh sách máy pilot CNC và model thực tế | Xác định phạm vi, tránh trộn tài liệu model khác |
| 1 | SOP bảo trì/an toàn còn hiệu lực của máy pilot | Điều kiện thực hiện và giới hạn thẩm quyền |
| 1 | Tiêu chuẩn đánh giá rung/nhiệt độ đúng bộ phận và điều kiện, nếu có | Nguồn cho ngưỡng, cách đo, đơn vị và tiêu chí; không lấy ngưỡng chung từ Internet |
| 2 | Case rung/nhiệt độ đã được duyệt tái sử dụng | Hiện tượng, điều kiện, kiểm tra, kết quả và giới hạn thực tế |
| 2 | Manual hoặc tài liệu xử lý lỗi đúng model đã được phép dùng | Căn cứ kỹ thuật và mã Alarm |
| 3 | Báo cáo BM/PM thô chưa duyệt tri thức | Ứng viên cho chuyên gia chọn lọc, không nhập thẳng kho chung |

Không cần đặt số lượng tài liệu tối thiểu tùy ý. Mỗi tình huống phải có nguồn đủ để hỗ trợ các nhận định dự kiến; nếu chưa có thì giữ trạng thái thiếu căn cứ. Sau khi biết nội dung mới xác định quy mô bộ câu hỏi nghiệm thu.

## 5. Kết quả cần đạt trước khi kết thúc bước 2

- Xác định kho/thư mục thực tế và người phụ trách dữ liệu CNC.
- Chốt danh sách máy/model pilot; điền bảng nguồn thực tế hoặc xác nhận chỉ phát triển demo khi chưa có dữ liệu thật.
- Phân loại từng nguồn đủ điều kiện/chờ bổ sung/chỉ tham chiếu/bị loại, kèm lý do.
- Xác định phần bao phủ và phần thiếu cho rung, nhiệt độ và an toàn.
- Chuyên gia phụ trách xác nhận phạm vi nội dung được phép dùng cho pilot; không dùng CSV tự khai thay thế quyết định này.

**Tiến độ:** hoàn thành phạm vi chuẩn bị mẫu theo lựa chọn của người dùng: kiểm kê demo, CSV nguồn thực tế trống và tiêu chí đánh giá. Chưa có dữ liệu thật để đọc/xác minh; điều kiện dữ liệu cho pilot thực tế chưa đạt. Chưa tạo embedding hoặc nhập nguồn vào kho RAG.

## 6. Cách dùng mẫu khi có tài liệu

1. Mở `docs/data/templates/CNC-REAL-SOURCES-TEMPLATE.csv` bằng Excel với mã hóa UTF-8 hoặc trình soạn thảo CSV.
2. Điền trước mã kiểm kê, tên, loại nguồn, vị trí lưu, model máy và chủ đề rung/nhiệt độ. Mỗi phiên bản nguồn là một dòng riêng.
3. Các thông tin chưa xác minh ghi `unknown`; `shared_rag_decision` đặt `pending_review`. Không dùng tên người được giao duyệt làm bằng chứng đã phê duyệt.
4. Bổ sung phiên bản, hiệu lực, bằng chứng duyệt và quyền đọc cùng chuyên gia phụ trách; phân loại theo mục 3.

Mẫu nguồn thật cố ý chưa có dòng dữ liệu. Không sao chép các nguồn trong danh sách demo sang bảng này rồi đổi nhãn thành production. Khi phát triển backend tiếp theo, có thể dùng fixture demo và giữ rõ giới hạn đó.
