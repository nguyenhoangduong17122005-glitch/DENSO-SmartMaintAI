# Dữ liệu mẫu bổ sung cho demo CNC

Toàn bộ dữ liệu tự soạn, không phải hồ sơ DENSO hoặc HozenDX thực tế. Bộ nguồn hiện có 14 tài liệu, 29 mục; bổ sung 4 hồ sơ với 4 đợt đã kết thúc và 8 ghi nhận. Máy trong các hồ sơ mới ở trạng thái chưa kiểm tra; công việc đang chờ, chưa có kết luận nguyên nhân.

## Cách dùng

Mở http://127.0.0.1:8001/, chọn Người bảo trì hoặc Chuyên gia, vào hệ thống. Nếu đang mở trang, tải lại để cập nhật danh sách hồ sơ. Các hồ sơ mới được cấp cho Nguyễn Minh và Trần Văn Hải. Giao diện prototype ở cổng 5500 dùng dữ liệu riêng trong trình duyệt, không tự nhận bộ hồ sơ backend này.

| Hồ sơ | Tình huống | Câu hỏi gợi ý | Nguồn |
|---|---|---|---|
| BM-DEMO-001 | Case rung sau thay dao — mô phỏng | undefined | DEMO-CNC-009 |
| BM-DEMO-002 | Case nhiệt độ tăng kèm Alarm — mô phỏng | undefined | DEMO-CNC-010 |
| BM-DEMO-003 | Case rung kèm tiếng ồn — mô phỏng | undefined | DEMO-CNC-011 |
| BM-DEMO-004 | Case nhiệt độ tăng sau đổi sản phẩm — mô phỏng | undefined | DEMO-CNC-012 |

Hai nguồn bổ sung khác:

- DEMO-CNC-013: mẫu ghi nhận số đo. Hỏi: “Phiếu số đo rung và nhiệt độ cần những trường nào?”
- DEMO-CNC-014: mẫu bàn giao. Hỏi: “Bàn giao sự cố CNC chưa kết luận cần ghi gì?”

Trong từng hồ sơ, dùng **Tra cứu tài liệu** rồi **Trả lời từ nguồn** và mở dẫn chứng. Nhật ký có hai ghi nhận mẫu: hiện tượng của người bảo trì và rà soát của chuyên gia. Bạn có thể bắt đầu đợt tiếp theo để diễn tiếp kịch bản. Thời điểm thực hiện của các ghi nhận mẫu chưa được xác minh nên để trống, không tạo số đo hoặc xác nhận chuyên gia giả.

## Nạp lại trên DB demo khác

Sau init-demo, chạy:

```powershell
py -m backend.manage add-samples
```

Chạy lại bỏ qua ID hồ sơ đã tồn tại; không cập nhật nội dung hồ sơ cũ, mật khẩu hoặc quyền. Tài liệu tra cứu được đọc trực tiếp từ fixtures/rag/cnc-demo-sources.json. Thêm các hồ sơ không tự biến nhật ký thành nguồn tri thức đã phê duyệt. Các hồ sơ tham chiếu cùng snapshot HozenDX mock, không thêm lịch sử giả vào nguồn HozenDX.
