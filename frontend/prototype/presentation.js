(function () {
  'use strict';
  const S=window.SM;
  let tour=null, timer=null;
  const step=(page,tab,selector,title,text,id)=>({page,tab,selector,title,text,id});
  const scripts={
    maintenance:[
      step('dashboard',null,'.stat-grid','Không gian người bảo trì','Các số liệu chỉ phản ánh hồ sơ bạn phụ trách. Máy, công việc và báo cáo được theo dõi riêng.'),
      step('new-case',null,'[name="type"]','Bắt đầu BM hoặc PM','Chọn xử lý sự cố hoặc bảo dưỡng định kỳ. Mỗi công việc có một hồ sơ xuyên suốt.'),
      step('new-case',null,'[name="assetId"]','Xác định đúng máy','Chọn mã máy để nhận lý lịch mô phỏng từ HozenDX. Người làm vẫn phải xác nhận đúng máy tại hiện trường.'),
      step('new-case',null,'.notice-warning','Tránh mở trùng công việc','Nếu máy có hồ sơ đang mở, tiếp tục hồ sơ đó. Chỉ tạo công việc độc lập khi có lý do.'),
      step('case','context','[name="symptom"]','Ghi hiện tượng thực tế','Dấu hiệu quan sát khác với nguyên nhân. Ghi Alarm và vị trí khi có, không kết luận hỏng bộ phận chỉ từ hiện tượng.','active'),
      step('case','context','[name="productModel"]','Bối cảnh và điểm thay đổi','Model sản phẩm khác model máy. Chế độ, tốc độ, ca làm việc và 5M1E giúp đối chiếu đúng tình huống.','active'),
      step('case','sources','[data-action="case-search"]','Tìm case và tri thức chuyên gia','Tra cứu ưu tiên các nguồn đã duyệt cùng nhóm máy. Không coi độ giống là xác suất sửa thành công.','active'),
      step('case','sources','.source-card','Đọc căn cứ trước khi quyết định','Nguồn có tác giả, phiên bản và giới hạn. Đọc bước kiểm tra, bối cảnh và an toàn; người bảo trì tự đánh giá khả năng áp dụng.','active'),
      step('case','work','[data-action="case-support"]','Yêu cầu chuyên gia khi cần','Gửi bối cảnh và những bước đã thử. Người bảo trì tiếp tục phụ trách hồ sơ, hỗ trợ và ghi nhận khi chuyên gia làm việc.','active'),
      step('case','work','[data-form="case-note"]','Ghi nhanh trong lúc xử lý','Chọn Quan sát, Kiểm tra, Nhận định, Thao tác hoặc Kết quả. Tách người nhập với người thực hiện, giữ cả kết quả chưa hiệu quả.','active'),
      step('case','work','[data-action="case-outcome"]','Kết thúc đợt, không mất lịch sử','Ghi kết quả kiểm chứng rồi chọn tiếp tục, chờ linh kiện, bàn giao hoặc kết thúc công việc. Chờ xử lý vẫn giữ hồ sơ mở.','active'),
      step('case','work','[data-action="case-resume"]','Tiếp tục qua nhiều đợt','Hồ sơ mẫu này đã có hai đợt và đang chờ linh kiện. Tiếp tục tạo đợt mới trong cùng mã hồ sơ.','waiting'),
      step('case','work','[name="status"]','PM dùng checklist có sẵn','Mẫu PM do hệ thống cấu hình theo máy. Ghi Đạt, Không đạt hoặc Chưa thực hiện; bất thường được điều tra trong cùng hồ sơ.','pm'),
      step('case','report','.status-strip','Máy phục hồi, báo cáo vẫn có thể chờ','Hồ sơ mẫu đã kết thúc công việc, nhưng còn chờ chuyên gia xác nhận. Mở lại đi thẳng báo cáo, không yêu cầu sửa máy lại.','report'),
      step('case','report','[name="summary"]','Rà báo cáo từ mọi đợt','AI mô phỏng ghép nhật ký thành bản nháp. Người phụ trách kiểm tra; phần sửa tay được giữ. Máy chạy lại không chứng minh nguyên nhân gốc.','report'),
      step('case','report','[data-action="case-report-finalize"]','Chốt báo cáo rồi đề xuất tri thức','Chỉ chốt khi công việc kết thúc và đủ xác nhận. Sau đó có thể giữ lịch sử hoặc tạo đề xuất tri thức riêng để chuyên gia trưởng duyệt.','report')
    ],
    expert:[
      step('dashboard',null,'.stat-grid','Hai nhiệm vụ của chuyên gia','Chia sẻ kinh nghiệm chủ động và hỗ trợ xử lý tại hiện trường. Mỗi đóng góp đều gắn người thực hiện.'),
      step('proposals',null,'[data-action="k-new"]','Ghi tri thức khi thuận tiện','Tạo bản nháp để ghi kinh nghiệm. Nháp chưa phải tri thức chính thức và được giữ để tiếp tục sau.'),
      step('proposal','raw','[name="rawText"]','Một ô để gõ hoặc dán','Nhập trực tiếp, dán note hoặc nội dung biên bản vào cùng ô. Ghi âm là hướng phát triển sau.','draft'),
      step('proposal','raw','[data-action="k-structure"]','AI sắp xếp, chuyên gia kiểm tra','Bản demo trích các dòng có nhãn vào biểu mẫu, giữ nội dung gốc và để trống phần thiếu. Không tự tạo dữ kiện.','draft'),
      step('proposal','form','[name="content.symptom"]','Rà biểu mẫu chuẩn','Kiểm tra dấu hiệu, điều kiện, bước kiểm tra, xử lý và kết quả. Mục chưa rõ cần ghi lý do.','draft'),
      step('proposal','form','[name="content.safety"]','Nêu an toàn và giới hạn','Ghi quy trình tham chiếu và phạm vi áp dụng. Kinh nghiệm của một máy không mặc nhiên đúng cho tất cả máy.','draft'),
      step('proposal','compare','.data-table','Đối chiếu trước khi gửi','So sánh từng mục với nguồn đã duyệt. Khác cách diễn đạt chưa chứng minh khác về chuyên môn; cần đọc nội dung hai phía.','draft'),
      step('proposal','compare','[name="mode"]','Chọn cách đưa vào kho','Tạo mới nếu có khác biệt có giá trị; bổ sung bằng phiên bản kế tiếp; lưu trữ nháp nếu hoàn toàn trùng. Không ghi đè lịch sử.','draft'),
      step('proposal','compare','[data-action="k-submit-preview"]','Gửi bản đã kiểm tra','Gửi kiểm duyệt khóa đúng bản nội dung. Theo dõi phản hồi và hoàn thiện nếu người duyệt yêu cầu bổ sung.','draft'),
      step('assignments',null,'.grid-2','Nhận hỗ trợ hiện trường','Chuyên gia nhận yêu cầu hoặc phản hồi chưa thể hỗ trợ. Khi bắt đầu tham gia, ghi thời điểm và công đoạn.'),
      step('case','work','.timeline','Giải thích quyết định, giữ dấu vết','Người bảo trì có thể ghi hộ trong quá trình xử lý. Nhật ký phân biệt ai nhập, ai làm, kết quả và lý do đổi hướng.','report'),
      step('case','work','[data-action="case-group-modal"]','Xác nhận theo nhóm đóng góp','Đọc và xác nhận phần của mình theo từng đợt. Không cần duyệt từng dòng; nội dung bị sửa sẽ cần xác nhận lại.','report'),
      step('case','report','[data-action="case-report-confirm-open"]','Xác nhận cách thể hiện trong báo cáo','Chỉ xác nhận phần đóng góp của mình hoặc yêu cầu sửa. Người bảo trì phụ trách chốt báo cáo; chuyên gia trưởng duyệt tri thức tái sử dụng.','report')
    ],
    lead:[
      step('dashboard',null,'.stat-grid','Không gian kiểm duyệt','Theo dõi hàng đợi và chất lượng tri thức. Vai trò này không thay người thực hiện xác nhận kết quả sửa chữa.'),
      step('review',null,'.data-table','Hàng đợi từ hai nguồn','Đề xuất đến từ chuyên gia hoặc báo cáo case đã xác nhận. Chỉ bản đã gửi mới vào hàng đợi.'),
      step('review-detail',null,'.split-layout .card','Đọc bản gửi duyệt','Kiểm tra tác giả, nội dung, bằng chứng, phạm vi và căn cứ gửi. Người có đóng góp không được tự duyệt nội dung của mình.','review'),
      step('review-detail',null,'details.card','Kiểm tra nội dung gốc','Đối chiếu tri thức đã cấu trúc với ghi chú gốc và phản hồi của tác giả để tránh mất ý hoặc diễn giải sai.','review'),
      step('review-detail',null,'.data-table','So sánh nguồn đã có','Xem bản gốc và đề xuất cạnh nhau. Khi bổ sung, kiểm tra phần thay đổi và nội dung cũ còn cần giữ.','review'),
      step('review-detail',null,'[name="decision"]','Ba quyết định rõ ràng','Phê duyệt, yêu cầu bổ sung hoặc từ chối. Quyết định chỉ tác động đề xuất tri thức, không xóa lịch sử công việc nguồn.','review'),
      step('review-detail',null,'[name="feedback"]','Mọi quyết định đều có phản hồi','Ghi lý do và căn cứ để tác giả biết nội dung nào phù hợp, còn thiếu hoặc chưa đủ bằng chứng.','review'),
      step('review-detail',null,'[name="suggestText"]','Sửa chuyên môn cần tác giả xác nhận','Có thể đề nghị nội dung thay thế, rồi trả về tác giả đọc và gửi lại. Chỉnh biên tập tiêu đề được lưu dấu vết.','review'),
      step('review-detail',null,'[name="reviewConfirmed"]','Xác nhận trước khi ra quyết định','Kiểm tra nguồn, an toàn và phạm vi chuyên môn. Hệ thống có bước xem lại trước khi lưu quyết định.','review'),
      step('library',null,'.grid-2','Tri thức chính thức sẵn sàng tra cứu','Chỉ nguồn đã xuất bản xuất hiện trong kho. Tác giả, người duyệt và phiên bản giúp truy vết trách nhiệm.'),
      step('knowledge-detail',null,'.page-head','Giữ phiên bản và ghi nhận đóng góp','Khi có bổ sung, lưu phiên bản mới và giữ bản trước. Kho này phục vụ lần tra cứu của người bảo trì và vòng tích lũy tiếp theo.','knowledge')
    ]
  };

  S.presentationScripts = scripts;
})();
