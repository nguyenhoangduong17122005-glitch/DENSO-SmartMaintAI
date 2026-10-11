/* Role guide for the database-backed demo; no simulated completion counters. */
(function () {
  'use strict';
  const S = window.SM;
  const flows = {
    maintenance: [
      ['Mở hồ sơ công việc', 'Tạo BM cho CNC-04 hoặc tiếp tục hồ sơ đang mở. Xác nhận đúng máy demo và ghi lý do nếu mở công việc độc lập.'],
      ['Ghi bối cảnh và tra cứu', 'Lưu hiện tượng, điều kiện và điểm thay đổi. Tra cứu tài liệu CNC, đọc trích dẫn và mở nguồn trước khi chọn hướng xử lý.'],
      ['Phối hợp và ghi nhật ký', 'Mở đợt, mời chuyên gia khi cần. Ghi kiểm tra, thao tác và kết quả; chọn đúng người thực hiện.'],
      ['Kết thúc đợt và công việc', 'Lưu tóm tắt cùng việc còn lại. Tiếp tục đợt mới nếu cần; chỉ kết thúc công việc khi đã có kết quả và căn cứ phù hợp.'],
      ['Xác nhận báo cáo', 'Chuyên gia xác nhận phần mình. Lập và gửi báo cáo, cập nhật nguồn nếu có thay đổi, rồi xác nhận tổng hợp.'],
      ['Đề xuất tri thức', 'Từ báo cáo đã xác nhận, tạo đề xuất, kiểm tra nội dung và gửi chuyên gia trưởng duyệt.']
    ],
    expert: [
      ['Nhận yêu cầu hỗ trợ', 'Vào Hỗ trợ hiện trường, đọc yêu cầu và nhận hoặc từ chối.'],
      ['Mở hồ sơ tham gia', 'Đọc bối cảnh, nhật ký các đợt và nguồn tra cứu của hồ sơ được cấp quyền.'],
      ['Ghi nhận và xác nhận', 'Ghi phần mình thực hiện; kiểm tra và xác nhận đúng phiên bản các đóng góp của mình. Không xác nhận thay người khác.']
    ],
    lead: [
      ['Mở hàng đợi kiểm duyệt', 'Đọc đề xuất đang chờ trong phạm vi máy được cấp quyền.'],
      ['Đối chiếu báo cáo nguồn', 'Kiểm tra bằng chứng, giới hạn áp dụng và tính độc lập với tác giả/người đóng góp.'],
      ['Quyết định và xuất bản', 'Nhập nhận xét rồi duyệt, yêu cầu bổ sung hoặc từ chối. Tri thức được duyệt chỉ vào RAG sau khi xuất bản thành công; thử lại nếu lập chỉ mục lỗi.']
    ]
  };
  S.actions['guide-open'] = () => {
    const role = S.user()?.role;
    const names = { maintenance: 'Người bảo trì', expert: 'Chuyên gia', lead: 'Chuyên gia trưởng' };
    const steps = flows[role] || [['Chọn vai trò', 'Chọn Người bảo trì — Nguyễn Minh để bắt đầu, rồi dùng menu đổi tài khoản khi cần phối hợp hoặc kiểm duyệt.']];
    S.modal('Hướng dẫn demo' + (role ? ' · ' + names[role] : ''),
      '<div class="stack"><p>Demo BM CNC-04 · thông tin thiết bị và tài liệu mô phỏng.</p>' +
      '<ol class="demo-guide-steps">' + steps.map(([title, text]) => '<li><strong>' + S.escape(title) + '</strong><span>' + S.escape(text) + '</span></li>').join('') +
      '</ol><p class="field-hint">Chờ thông báo lưu thành công trước khi rời biểu mẫu. Trên Live Demo, dữ liệu đã lưu được dùng chung theo quyền.</p></div>',
      S.button('Đã hiểu', 'close-modal', 'primary'));
  };
})();
