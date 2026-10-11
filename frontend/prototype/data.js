/* Fictional fixtures for prototype walkthroughs. No factory production data. */
(function () {
  'use strict';
  const SM = window.SM;
  SM.seed(db => {
    if (db.seededBase) return;
    db.seededBase = true;
    db.users = [
      { id: 'u-minh', name: 'Nguyễn Minh', role: 'maintenance', initials: 'NM' },
      { id: 'u-hai', name: 'Trần Văn Hải', role: 'expert', initials: 'TH' },
      { id: 'u-anh', name: 'Lê Quốc Anh', role: 'lead', initials: 'QA' },
      { id: 'u-lan', name: 'Phạm Ngọc Lan', role: 'maintenance', initials: 'NL' },
      { id: 'u-nam', name: 'Lê Hoàng Nam', role: 'expert', initials: 'HN' },
    ];
    const sourceAt = '2026-10-09T00:00:00.000Z';
    db.assets = [
      {
        id: 'VIS-01', name: 'Máy kiểm tra hình ảnh', family: 'Vision', maker: 'Nhà chế tạo A (mô phỏng)', model: 'VI-200', year: 2021,
        line: 'Line A · Khu kiểm tra', specs: 'Camera công nghiệp; chiếu sáng vòng; kiểm tra ngoại quan sản phẩm', sourceAt, sourceState: 'Hoạt động tại lần ghi nhận nguồn',
        pmTemplate: { id: 'PM-VIS-01', version: 2, name: 'Kiểm tra định kỳ Vision · mẫu nội bộ demo', items: [
          { id: 'lens', label: 'Tình trạng cụm quang học', unit: '', criterion: 'Đối chiếu tiêu chuẩn trong SOP-VIS-01; ghi hiện trạng quan sát.' },
          { id: 'fixture', label: 'Tình trạng gá và vị trí cảm biến', unit: '', criterion: 'Ghi hiện trạng và sai khác so với hồ sơ chuẩn.' },
          { id: 'sample', label: 'Kết quả kiểm tra mẫu chuẩn', unit: 'mẫu', criterion: 'Ghi số mẫu và kết quả theo tiêu chuẩn áp dụng đã xác minh.' },
        ] },
        references: [
          { id: 'SOP-VIS-01', title: 'Quy trình bảo trì máy kiểm tra hình ảnh', version: '2.1', type: 'SOP', summary: 'Bản tham chiếu mô phỏng. Khi triển khai cần xác minh quy trình được nhà máy phê duyệt, điều kiện an toàn và thẩm quyền trước thao tác. Prototype không chứa hướng dẫn vận hành thực tế.' },
          { id: 'DAS-VIS-01', title: 'Tiêu chuẩn kiểm tra hình ảnh', version: '1.3', type: 'DAS', summary: 'Mẫu minh họa tiêu chí đánh giá, master kiểm tra và model sản phẩm. Ngưỡng đạt cần lấy từ tài liệu được cấp và xác minh, không do AI tạo.' },
        ],
        history: [
          { id: 'HZ-BM-0821', date: '2026-09-18T02:10:00Z', type: 'BM', summary: 'Camera không nhận sản phẩm sau đổi model. Lịch sử nguồn dùng tham khảo; chưa tự động trở thành tri thức đã duyệt.' },
          { id: 'HZ-PM-0912', date: '2026-10-02T02:00:00Z', type: 'PM', summary: 'Đã ghi nhận kiểm tra định kỳ cụm quang học theo hồ sơ nguồn mô phỏng.' },
        ],
      },
      {
        id: 'CNC-04', name: 'Máy gia công CNC', family: 'CNC', maker: 'Nhà chế tạo B (mô phỏng)', model: 'MC-400', year: 2019,
        line: 'Line B · Khu gia công', specs: 'Trung tâm gia công; cụm trục chính; bộ gá sản phẩm', sourceAt, sourceState: 'Chưa cập nhật tình trạng hiện tại',
        pmTemplate: { id: 'PM-CNC-01', version: 1, name: 'Kiểm tra định kỳ CNC · mẫu nội bộ demo', items: [
          { id: 'visual', label: 'Quan sát tình trạng cụm máy', unit: '', criterion: 'Ghi bất thường theo checklist của máy đã xác minh.' },
          { id: 'lubrication', label: 'Tình trạng hệ thống bôi trơn', unit: '', criterion: 'Đối chiếu tiêu chuẩn bảo trì đúng model máy.' },
          { id: 'run', label: 'Kết quả kiểm tra theo quy trình', unit: '', criterion: 'Người có thẩm quyền xác nhận điều kiện kiểm tra và tiêu chí đạt.' },
        ] },
        references: [{ id: 'SOP-CNC-04', title: 'Quy trình bảo trì CNC', version: '3.0', type: 'SOP', summary: 'Tham chiếu mô phỏng. Quy trình, quyền thao tác và điều kiện an toàn phải được xác minh tại nhà máy; không sử dụng mẫu demo như chỉ dẫn vận hành.' }],
        history: [{ id: 'HZ-BM-0786', date: '2026-09-24T03:00:00Z', type: 'BM', summary: 'Ghi nhận rung bất thường trong quá trình gia công; hồ sơ thô chưa qua kiểm duyệt tri thức.' }],
      },
      {
        id: 'PRESS-02', name: 'Máy ép lắp ráp', family: 'Máy ép', maker: 'Nhà chế tạo C (mô phỏng)', model: 'PR-120', year: 2020,
        line: 'Line C · Khu lắp ráp', specs: 'Cụm ép lắp; cảm biến vị trí; ghi nhận kết quả ép', sourceAt, sourceState: 'Chưa có trạng thái đủ mới',
        pmTemplate: { id: 'PM-PRESS-01', version: 1, name: 'Kiểm tra máy ép · mẫu nội bộ demo', items: [
          { id: 'position', label: 'Tình trạng cơ cấu và cảm biến', unit: '', criterion: 'Theo tiêu chuẩn bảo trì máy ép đã được xác minh.' },
          { id: 'verification', label: 'Xác nhận kết quả kiểm tra', unit: '', criterion: 'Ghi bằng chứng thực tế; chưa thực hiện không được đánh dấu đạt.' },
        ] },
        references: [{ id: 'SOP-PRESS-02', title: 'Quy trình bảo trì máy ép', version: '1.0', type: 'SOP', summary: 'Nguồn mẫu. Cần cung cấp và xác minh bản quy trình nhà máy trước khi dùng để hướng dẫn thao tác.' }],
        history: [],
      },
    ];
    db.knowledge = [
      {
        id: 'KN-024', title: 'Camera không nhận sản phẩm sau khi đổi model', family: 'Vision', assetIds: ['VIS-01'], kind: 'expert', authorId: 'u-hai', reviewerId: 'u-anh', contributors: [], version: 2, status: 'published', updatedAt: '2026-10-06T03:20:00Z', tags: ['Camera', 'Đổi model', 'Điểm thay đổi'],
        content: { symptom: 'Camera không nhận sản phẩm hoặc tỷ lệ NG tăng sau chuyển model sản phẩm.', context: 'Máy Vision; lỗi xuất hiện sau thay đổi model sản phẩm. Cần xác minh bộ mẫu, điều kiện chiếu sáng và cài đặt đang áp dụng.', checks: 'Đối chiếu lịch sử thay đổi và dữ liệu kiểm tra với cấu hình/model đã được phê duyệt; thu thập ảnh trước và sau.', solution: 'Chọn hướng kiểm tra theo sai khác đã xác nhận và quy trình máy; chuyên gia quyết định xử lý trong thẩm quyền.', result: 'Kinh nghiệm giúp ưu tiên xác minh điểm thay đổi. Không cam kết nguyên nhân hay kết quả cho máy khác.', safety: 'Xác minh SOP-VIS-01 đúng phiên bản, điều kiện an toàn và quyền thao tác trước khi thực hiện. Đây là nội dung demo.', limits: 'Không áp dụng như kết luận nguyên nhân khi chưa kiểm tra tại hiện trường; chưa có dữ liệu cho model máy khác.', cause: 'Cần phân biệt sai cấu hình với hư hỏng phần cứng; đây là các khả năng cần kiểm chứng.', evidence: 'Kinh nghiệm chuyên gia mô phỏng; liên hệ case CS-112 để đối chiếu bối cảnh.' }, history: [],
      },
      {
        id: 'CS-112', title: 'Vision: ghi nhận sai khác sau thay model sản phẩm', family: 'Vision', assetIds: ['VIS-01'], kind: 'case', authorId: 'u-nam', reviewerId: 'u-anh', contributors: ['u-lan'], version: 1, status: 'published', updatedAt: '2026-09-22T07:15:00Z', tags: ['Case đã duyệt', 'Vision', 'Mẫu chuẩn'],
        content: { symptom: 'Camera không nhận một số sản phẩm sau đổi model.', context: 'Dữ liệu mô phỏng: model sản phẩm P-A; Line A; lỗi ghi nhận ngay sau chuyển sản xuất.', checks: 'Đợt đầu ghi nhận hiện tượng và đối chiếu ảnh; lỗi vẫn còn. Đợt sau chuyên gia xác minh dữ liệu mẫu và cấu hình liên quan.', solution: 'Chuyên gia thực hiện hướng xử lý theo sai khác được xác nhận; người bảo trì ghi lại diễn biến và kết quả kiểm tra.', result: 'Ca minh họa ghi nhận máy phục hồi sau xử lý và xác nhận theo tiêu chí của ca. Nguyên nhân gốc chưa đủ bằng chứng để kết luận.', safety: 'Điều kiện thao tác tuân thủ quy trình máy đã được nhà máy phê duyệt. Nội dung mô phỏng cần xác minh trước áp dụng.', limits: 'Kết quả thuộc một ca mẫu; model, bộ gá và điều kiện của ca hiện tại cần đối chiếu riêng.', cause: 'Chưa xác định nguyên nhân gốc.', evidence: 'Báo cáo ca mô phỏng và xác nhận đóng góp của chuyên gia.' }, history: [],
      },
      {
        id: 'KN-031', title: 'Ghi nhận rung bất thường ở cụm trục chính CNC', family: 'CNC', assetIds: ['CNC-04'], kind: 'expert', authorId: 'u-nam', reviewerId: 'u-anh', contributors: [], version: 1, status: 'published', updatedAt: '2026-10-03T05:00:00Z', tags: ['CNC', 'Rung', 'Điều kiện vận hành'],
        content: { symptom: 'Người vận hành ghi nhận rung bất thường khi gia công.', context: 'Cần ghi model sản phẩm, chế độ, tốc độ đã quan sát và thay đổi gần nhất; chưa đủ dữ kiện chỉ từ dấu hiệu rung.', checks: 'Đối chiếu dữ liệu tại cùng điều kiện; ghi thời điểm, vị trí, điều kiện xảy ra và kết quả từng bước được phép thực hiện.', solution: 'Nếu dữ kiện chưa đủ hoặc vượt quyền xử lý, bàn giao thông tin cho chuyên gia phụ trách.', result: 'Chuẩn hóa bối cảnh để chuyên gia điều tra; chưa suy ra biện pháp sửa cụ thể.', safety: 'Tham chiếu SOP-CNC-04 và quy định an toàn tại máy; không dùng nội dung demo để vận hành.', limits: 'Không áp dụng ngưỡng rung hoặc kết luận bộ phận hỏng khi chưa có tiêu chuẩn, số đo và xác minh.', cause: 'Chưa xác định; phải kiểm chứng các giả thuyết.', evidence: 'Ví dụ tri thức đã duyệt trong môi trường mô phỏng.' }, history: [],
      },
    ];
    db.notifications = [
      { id: 'NT-WELCOME-M', userId: 'u-minh', title: 'Tiếp tục hồ sơ đang xử lý', body: 'Hồ sơ Vision có nhật ký và kết quả chưa phục hồi. Bạn có thể tiếp tục ghi nhận trong cùng hồ sơ.', route: { page: 'cases' }, createdAt: '2026-10-09T01:00:00Z', read: false },
      { id: 'NT-WELCOME-E', userId: 'u-hai', title: 'Không gian làm việc của chuyên gia', body: 'Xem các hồ sơ đang tham gia và nhóm đóng góp cần xác nhận.', route: { page: 'assignments' }, createdAt: '2026-10-09T01:00:00Z', read: false },
      { id: 'NT-WELCOME-L', userId: 'u-anh', title: 'Có đề xuất tri thức cần xem xét', body: 'Đọc bối cảnh, bằng chứng và phần đối chiếu trước khi quyết định.', route: { page: 'review' }, createdAt: '2026-10-09T01:00:00Z', read: false },
    ];
  });
})();
