(function(){
  'use strict';
  const S=window.SM, chapters=['Ý tưởng & giả định','Người bảo trì · xử lý','Chuyên gia','Người bảo trì · hoàn tất','Chuyên gia trưởng','Tổng kết'];
  const plans=S.presentationScripts, steps=[];
  const make=(page,tab,selector,title,text,id,extra={})=>({page,tab,selector,title,text,id,...extra});
  const f=(name,title,text)=>({selector:`[name="${name}"]`,title,text});
  function insert(role,title,items){const list=plans[role],i=list.findIndex(s=>s.title===title);if(i<0)throw Error(title);const base=list[i];list.splice(i+1,0,...items.map(s=>({...base,...s})));}
  insert('maintenance','Xác định đúng máy',[
    {selector:'.split-layout > aside',title:'Lý lịch từ nguồn và quan sát hiện trường',text:'Model máy, nhà chế tạo, khu vực và thời điểm nguồn được điền sẵn. Trạng thái lưu trong HozenDX không thay thế quan sát thực tế.'},
    f('title','Tên công việc và mã Alarm','Tên công việc ngắn giúp tìm lại. Alarm chỉ ghi khi có; không tự tạo mã lỗi giả.'),
    f('machineConfirmed','Xác nhận đúng máy trước khi mở hồ sơ','Đối chiếu mã máy tại hiện trường. Nếu cùng công việc đang mở, tiếp tục hồ sơ đó; công việc độc lập cần ghi lý do.')
  ]);
  insert('maintenance','Bối cảnh và điểm thay đổi',[
    f('alarm','Mã lỗi và bộ phận','Ghi Alarm và vị trí lỗi nếu có. Dấu hiệu quan sát chưa phải nguyên nhân.'),
    f('speed','Điều kiện vận hành','Chế độ, tốc độ, ca và môi trường giúp so sánh hai tình huống. Phần chưa rõ giữ là chưa xác minh.'),
    f('change_2','Điểm thay đổi 5M1E','Tìm điều đã thay đổi trước lỗi: con người, máy, vật liệu/sản phẩm, phương pháp, đo lường và môi trường. Chưa kiểm tra khác với chưa ghi nhận thay đổi.')
  ]);
  insert('maintenance','Đọc căn cứ trước khi quyết định',[
    {selector:'[data-action="case-source-read"]',title:'Bấm đọc nguồn đầy đủ',text:'Mở nguồn để xem bối cảnh, bằng chứng, hướng kiểm tra và giới hạn. Không quyết định chỉ từ tên case.'},
    {selector:'#modal .modal-body',title:'Thông tin trong nguồn tham khảo',text:'Nguồn có tác giả, người duyệt và phiên bản. Đọc cả an toàn và phạm vi áp dụng; quy trình trong demo chưa phải hướng dẫn vận hành thực tế.',modal:'source'},
    {selector:'#modal [data-action="case-source-pick"]',title:'Chọn làm hướng tham khảo',text:'Nút này ghi nhận lựa chọn, không ghi đã làm và không xác nhận máy phục hồi. Kết quả áp dụng sẽ được ghi trong nhật ký.',modal:'source'}
  ]);
  insert('maintenance','Yêu cầu chuyên gia khi cần',[
    {...f('expertId','Chọn chuyên gia','Chọn Trần Văn Hải cho tình huống minh họa. Người bảo trì vẫn là chủ hồ sơ.'),modal:'support'},
    {...f('reason','Nêu vấn đề chưa giải quyết','Ví dụ: lỗi còn sau kiểm tra ban đầu, cần đánh giá điểm thay đổi khi chuyển model. Thông tin rõ giúp chuyên gia chuẩn bị.'),modal:'support'},
    {...f('handover','Rà tóm tắt bàn giao','Tóm tắt được ghép từ bối cảnh và các bước đã thử. Đọc lại trước khi gửi để không bỏ mất kết quả chưa hiệu quả.'),modal:'support'},
    {selector:'#modal button[type="submit"]',title:'Gửi yêu cầu trong ứng dụng',text:'Yêu cầu đến tài khoản chuyên gia; trạng thái chờ phản hồi được giữ trong hồ sơ. Phần chuyên gia sẽ minh họa nhận yêu cầu.',modal:'support'}
  ]);
  insert('maintenance','Ghi nhanh trong lúc xử lý',[
    f('type','Chọn loại ghi nhận','Quan sát, Kiểm tra, Nhận định, Thao tác và Kết quả giúp phân biệt dữ kiện với suy đoán.'),
    f('performedBy','Tách người nhập và người làm','Sau khi chuyên gia nhận và bắt đầu tham gia, người bảo trì có thể ghi hộ và chọn đúng người thực hiện. Người nhập được lấy từ tài khoản.'),
    f('content','Ghi theo mốc trong lúc xử lý','Ghi điều đã thấy hoặc thực hiện. Không cần chờ cuối ca nhớ lại; chưa biết nguyên nhân vẫn lưu được.'),
    f('result','Kết quả và lý do đổi hướng','Ghi kết quả thực tế, kể cả lỗi vẫn còn. Lý do lựa chọn giữ lại kinh nghiệm vì sao ưu tiên một bước.'),
    f('performedAt','Ghi bù và số đo','Mở phần bổ sung khi cần ghi số đo, đơn vị, thời điểm thực tế. Thời điểm thực hiện và thời điểm nhập được lưu riêng.'),
    {selector:'[data-form="case-note"] button[type="submit"]',title:'Lưu mốc vào nhật ký',text:'Nháp ô nhập được giữ trên trình duyệt. Nhấn Lưu ghi nhận để tạo mốc chính thức trong hồ sơ; ghi hộ chuyên gia cần xác nhận.'},
    {selector:'.timeline',title:'Đọc dấu vết và chỉnh sửa',text:'Mỗi mốc có ai làm, ai nhập, thời gian, nội dung, kết quả và lý do. Khi chỉnh sửa, bản trước vẫn còn trong lịch sử.'}
  ]);
  insert('maintenance','Kết thúc đợt, không mất lịch sử',[
    {...f('machineState','Ghi tình trạng máy thực tế','Đã phục hồi, chưa phục hồi hoặc chưa đủ kiểm chứng cần căn cứ quan sát; không suy từ hướng xử lý dự kiến.'),modal:'outcome'},
    {...f('next','Chọn bước tiếp theo','Tiếp tục cùng đợt, chờ linh kiện, chờ hỗ trợ, bàn giao hoặc kết thúc công việc. Chờ không được ghi thành hoàn tất.'),modal:'outcome'},
    {...f('summary','Kiểm tra tóm tắt đợt','Tóm tắt từ nhật ký phục vụ ca tiếp theo; nêu việc còn lại và người nhận khi bàn giao. Kết thúc chưa khắc phục cần quyết định bên ngoài có thẩm quyền.'),modal:'outcome'}
  ]);
  insert('maintenance','PM dùng checklist có sẵn',[
    f('abnormality','Bất thường PM vẫn nằm trong cùng hồ sơ','Chọn Không đạt rồi mô tả hiện tượng và mở điều tra gắn hạng mục. Không mất checklist gốc hoặc tự đánh dấu hạng mục là Đạt.'),
  ]);
  insert('maintenance','Rà báo cáo từ mọi đợt',[
    {selector:'[data-action="case-report-generate"]',title:'Xem nháp mới trước khi áp dụng',text:'Tạo gợi ý từ mọi đợt, bao gồm các lần chưa hiệu quả. AI không tự thay phần người dùng đã sửa.'},
    {selector:'#modal .modal-body',title:'Áp dụng từng phần có chọn lọc',text:'Mục đã sửa tay mặc định giữ nguyên. Chọn phần muốn áp dụng rồi xác nhận đã đối chiếu nguồn; xem nháp không đóng công việc.',modal:'report'},
    {selector:'[data-action="case-report-request"]',title:'Gửi yêu cầu xác nhận đóng góp',text:'Người bảo trì không xác nhận thay chuyên gia. Có thể để báo cáo chờ và trở lại sau khi người tham gia phản hồi.'}
  ]);
  insert('maintenance','Chốt báo cáo rồi đề xuất tri thức',[
    {selector:'#modal .modal-body',title:'Xem điều kiện chốt báo cáo',text:'Nhánh minh họa sau khi đã đủ xác nhận: người phụ trách kiểm tra kết quả và ký xác nhận báo cáo. Báo cáo vẫn độc lập với tri thức tái sử dụng.',modal:'finalize',stage:'confirmed-contributions'},
    {selector:'[data-action="case-propose"]',title:'Báo cáo đã xác nhận: có thể đề xuất bài học',text:'Đây là trạng thái minh họa sau khi chốt. Có thể chỉ giữ lịch sử, hoặc tạo bản đề xuất tri thức riêng; dữ liệu công việc không bị thay đổi.',stage:'final-report'},
    {selector:'[name="content.checks"]',title:'Từ báo cáo sang nháp case tri thức',text:'Biểu mẫu lấy dữ kiện từ báo cáo đã xác nhận. Tour dừng ở bản nháp để thấy lịch sử ca vẫn tách riêng; khi thao tác tự do, người gửi bổ sung giới hạn, đối chiếu kho rồi gửi kiểm duyệt.',modal:'case-proposal',stage:'final-report'}
  ]);
  insert('expert','Một ô để gõ hoặc dán',[
    {selector:'[data-action="k-sample"]',title:'Dùng ghi chú mẫu để hiểu cấu trúc',text:'Mẫu minh họa có nhãn Dấu hiệu, Điều kiện, Kiểm tra… Văn bản gốc luôn được giữ để đối chiếu.'}
  ]);
  insert('expert','AI sắp xếp, chuyên gia kiểm tra',[
    {selector:'#modal .modal-body',title:'Xem trước cách chia biểu mẫu',text:'Bản xem trước nêu mục có thông tin và mục thiếu. Nhiều chủ đề có thể tách thành nhiều nháp. Chỉ điền ô trống, không ghi đè phần đã sửa.',modal:'structure'}
  ]);
  insert('expert','Rà biểu mẫu chuẩn',[
    f('title','Tiêu đề và loại máy','Đặt tên có hiện tượng và điều kiện quan trọng. Loại máy xác định phạm vi tra cứu.'),
    f('content.context','Điều kiện áp dụng','Ghi model sản phẩm, chế độ và các thay đổi liên quan; kinh nghiệm của một điều kiện chưa chắc đúng ở điều kiện khác.'),
    f('content.checks','Bước kiểm tra và căn cứ','Nêu kiểm tra gì, thấy gì và vì sao chọn hoặc đổi hướng. Đây là phần giữ lại bí quyết chuyên gia.'),
    f('content.solution','Cách xử lý và bài học','Tách điều thực sự đã làm với khuyến nghị chưa thực hiện. Giữ cả hướng thử chưa hiệu quả.'),
    f('content.result','Kết quả và cách kiểm chứng','Nêu kết quả, tiêu chí và phần chưa đạt; thiếu dữ kiện cần ghi lý do.'),
    f('content.cause','Nguyên nhân khác giả thuyết','Máy chạy lại không chứng minh nguyên nhân gốc. Chọn trạng thái nguyên nhân phù hợp mức bằng chứng.'),
    f('content.evidence','Bằng chứng và nguồn','Dẫn hồ sơ, kiểm tra hoặc dữ kiện liên quan để người duyệt có thể đối chiếu.')
  ]);
  insert('expert','Nêu an toàn và giới hạn',[
    f('content.limits','Giới hạn và lúc cần chuyên gia','Mô tả điều kiện không áp dụng, điều chưa kiểm chứng và khi nào cần người có kinh nghiệm đánh giá.'),
    {selector:'[data-input="k-author-check"]',title:'Xác nhận đã kiểm tra biểu mẫu',text:'Tác giả chịu trách nhiệm đọc cách phân loại và nội dung. Thay đổi nội dung sẽ cần xác nhận và đối chiếu lại.'},
    {selector:'[data-action="k-compare"]',title:'Bấm đối chiếu kho',text:'Hệ thống tìm nguồn đã duyệt để giúp nhận ra nội dung trùng hoặc phần mới có giá trị.'}
  ]);
  insert('expert','Chọn cách đưa vào kho',[
    f('targetId','Nguồn gốc và phiên bản cần bổ sung','Khi cập nhật hoặc lưu trữ trùng, gắn đúng nguồn được đối chiếu. Nguồn đổi phiên bản thì phải đọc lại.'),
    f('rationale','Giải thích điểm mới hoặc khác biệt','Nêu điều kiện khác hoặc bằng chứng bổ sung để người duyệt hiểu vì sao cần tri thức này.'),
    {selector:'[data-action="k-withdraw"]',title:'Nhánh trùng hoàn toàn',text:'Lưu trữ nháp kèm nguồn và lý do nếu không có gì mới. Không xuất bản một bản trùng và không xóa dấu vết tác giả.'}
  ]);
  insert('expert','Gửi bản đã kiểm tra',[
    {selector:'#modal .modal-body',title:'Xem lại bản gửi kiểm duyệt',text:'Kiểm tra tác giả, phiên bản, loại đề xuất và căn cứ trước gửi. Bản gửi sẽ khóa chờ duyệt, chưa trở thành tri thức chính thức.',modal:'submit'},
    {page:'proposal',tab:'form',id:'feedback',selector:'.notice-warning',title:'Nhánh người duyệt trả bổ sung',text:'DP-027 minh họa phản hồi. Tác giả sửa, trả lời yêu cầu, xác nhận và đối chiếu lại trước khi gửi lại.'}
  ]);
  insert('expert','Nhận hỗ trợ hiện trường',[
    {selector:'[data-action="case-support-accept"]',title:'Nhận hoặc phản hồi chưa thể hỗ trợ',text:'BM-26031 mang yêu cầu từ người bảo trì. Nếu không sẵn sàng, phản hồi lý do để người phụ trách chủ động tìm hỗ trợ.',stage:'requested'},
    {page:'case',id:'active',tab:'work',selector:'[data-action="case-support-join"]',title:'Nhận yêu cầu chưa có nghĩa đã đến hiện trường',text:'Bấm bắt đầu tham gia để ghi thời điểm và công đoạn. Vai trò chủ hồ sơ vẫn thuộc người bảo trì.',stage:'accepted'},
    {page:'case',id:'active',tab:'work',selector:'#modal [name="stage"]',title:'Ghi công đoạn tham gia',text:'Ví dụ điều tra sau kiểm tra ban đầu. Thông tin này giúp truy vết chuyên gia tham gia từ phần nào.',stage:'accepted',modal:'join'}
  ]);
  insert('expert','Xác nhận theo nhóm đóng góp',[
    {selector:'#modal .modal-body',title:'Đọc nhóm trước khi xác nhận',text:'Chỉ xác nhận phần của mình. Nếu nội dung sai, yêu cầu sửa kèm lý do; bản được sửa phải được xác nhận lại.',modal:'group'}
  ]);
  insert('expert','Xác nhận cách thể hiện trong báo cáo',[
    {selector:'#modal .modal-body',title:'Chuyên gia xác nhận, bảo trì chốt',text:'Kiểm tra cách báo cáo thể hiện đóng góp. Có thể xác nhận đúng hoặc yêu cầu sửa; người phụ trách chốt khi đủ điều kiện.',modal:'confirm'}
  ]);
  insert('lead','Xác nhận trước khi ra quyết định',[
    {selector:'[data-form="k-decision"] button[type="submit"]',title:'Xem lại quyết định trước khi lưu',text:'Kịch bản chọn phê duyệt sau khi đã kiểm tra. Yêu cầu bổ sung hoặc từ chối cũng đều có phản hồi.'},
    {selector:'#modal .modal-body',title:'Xác nhận quyết định kiểm duyệt',text:'Phê duyệt đưa tri thức vào kho. Quyết định không sửa nhật ký hay kết quả sửa chữa nguồn.',modal:'decision'}
  ]);
  const intro=[
    ['.login-story','Vấn đề: kinh nghiệm chưa được giữ có hệ thống','Kinh nghiệm nằm trong đầu chuyên gia hoặc trao đổi rời rạc. Khi máy lỗi, người bảo trì mất thời gian tìm hướng xử lý và có thể lặp lại việc đã thử.'],
    ['.login-stats','Ý tưởng: hai nguồn, một kho đã duyệt','Nguồn thứ nhất là tri thức chuyên gia; nguồn thứ hai là bài học rút từ hồ sơ BM/PM. AI giúp sắp biểu mẫu, tìm nguồn và tóm tắt; chuyên gia trưởng quyết định tri thức nào được tái sử dụng.'],
    ['.login-card .notice','Giả định của prototype','Tài khoản, máy và nội dung là mô phỏng. AI chưa nối LLM. HozenDX chỉ giả định đọc dữ liệu theo máy; không giả định alarm trực tiếp, lịch PM hoặc quyền ghi trả.'],
    ['.role-options','Ba vai trò, trách nhiệm khác nhau','Nguyễn Minh phụ trách ca BM-26031 và nhận hỗ trợ từ Trần Văn Hải. Ca BM-26021 minh họa bước xác nhận báo cáo. Hải còn gửi tri thức về cùng nhóm máy Vision; Lê Quốc Anh kiểm duyệt trước khi xuất bản.'],
    ['.login-tour','Cách theo dõi hành trình','Bấm vùng sáng hoặc Tiếp theo để mô phỏng thao tác. Hộp Thao tác nói cần bấm hay nhập gì; hộp Hệ thống hiển thị giải thích kết quả. Các bước dùng trạng thái mẫu và không ghi đè dữ liệu đang làm.']
  ];
  intro.forEach(([selector,title,text])=>steps.push({page:'login',selector,title,text,chapter:0}));
  const signIn=(role,chapter,user,name)=>{
    steps.push({chapter,page:'login',selector:`[value="${user}"]`,title:'Chọn tài khoản '+name,text:'Chọn đúng tài khoản để thấy hồ sơ, yêu cầu và quyền của người này. Trong demo, đây là thao tác đăng nhập mô phỏng.',account:user});
    steps.push({chapter,page:'login',selector:'.login-submit',title:'Bấm Vào bản demo',text:'Hệ thống mở không gian làm việc theo vai trò vừa chọn, kèm menu và công việc liên quan.',account:user});
  };
  const shell=(role,chapter)=>[
    {selector:'.breadcrumbs',title:'Biết mình đang ở màn hình nào',text:'Thanh trên cùng ghi vị trí hiện tại. Sau mỗi lần mở hồ sơ hoặc đề xuất, tên màn hình đổi để người xem không nhầm ngữ cảnh.'},
    {selector:'.nav-list',title:'Menu theo vai trò',text:'Chọn mục trong menu trái để mở đúng công việc. Người bảo trì có hồ sơ và đề xuất từ hồ sơ; chuyên gia có hỗ trợ và tri thức của tôi; chuyên gia trưởng có hàng đợi duyệt.'},
    {selector:'.notification-button',title:'Thông báo gắn với hồ sơ',text:'Bấm biểu tượng chuông để xem yêu cầu hỗ trợ, phản hồi kiểm duyệt hoặc xác nhận còn chờ. Mỗi thông báo dẫn về hồ sơ liên quan.'},
    {selector:'.demo-ribbon',title:'Trạng thái dữ liệu của prototype',text:'Dải này cho biết dữ liệu nhà máy, AI và HozenDX là mô phỏng; trạng thái lưu cho biết thay đổi đã nằm trên trình duyệt hay chưa.'},
    {selector:'.stat-grid',title:'Việc cần chú ý của '+chapters[chapter].toLowerCase(),text:'Các ô số đếm công việc thuộc tài khoản hiện tại và trạng thái cần xử lý. Bên dưới là danh sách hồ sơ hoặc đề xuất để bấm mở trực tiếp.'},
    {selector:'.page-head .actions .btn',title:'Nút bắt đầu công việc chính',text:'Nút đỏ ở đầu trang dẫn tới việc ưu tiên theo vai trò: mở ca, ghi tri thức hoặc mở hàng đợi kiểm duyệt.'},
    {selector:'.dashboard-grid .stack .card:first-child',title:'Bắt đầu từ danh sách công việc',text:'Bấm Tiếp tục, Mở hỗ trợ hoặc Xem hàng đợi trong thẻ này để đi vào việc thật. Mã hồ sơ và trạng thái giúp tránh làm nhầm ca.'},
    {selector:'.dashboard-grid .stack .card:last-child',title:'Tri thức vừa xuất bản',text:'Chỉ nội dung đã được duyệt xuất hiện tại đây. Bấm tên bài hoặc Tra cứu kho để đọc nguồn, tác giả và phiên bản.'},
    {selector:'.dashboard-grid aside .card',title:'Dữ liệu máy từ HozenDX',text:'Bấm Xem phạm vi tích hợp để biết prototype chỉ mô phỏng đọc lý lịch theo mã máy. Người bảo trì vẫn xác nhận thực tế tại hiện trường.'}
  ].map(s=>({...s,page:'dashboard',role,chapter}));
  const maintenance=plans.maintenance;
  const reportStart=maintenance.findIndex(s=>s.title==='Máy phục hồi, báo cáo vẫn có thể chờ');
  const maintenanceReport=maintenance.splice(reportStart);
  signIn('maintenance',1,'u-minh','Nguyễn Minh');
  steps.push(...shell('maintenance',1));
  steps.push(
    {chapter:1,role:'maintenance',page:'notifications',selector:'.notification-row',title:'Mở thông báo từ biểu tượng chuông',text:'Mỗi dòng nêu việc gì thay đổi, thời điểm và nút Xem dẫn đến đúng hồ sơ. Dấu Mới chỉ là trạng thái chưa đọc, không phải mức khẩn cấp.',action:'Bấm chuông ở góc trên, rồi bấm “Xem” trên thông báo cần xử lý.'},
    {chapter:1,role:'maintenance',page:'integration',selector:'.grid-3',title:'Hiểu ranh giới HozenDX trước khi mở ca',text:'Ba thẻ nêu dữ liệu máy đọc theo mã, checklist PM nội bộ và chiều ghi trả chưa cấu hình. Prototype không nhận alarm trực tiếp hay lịch PM từ HozenDX.',action:'Bấm “Dữ liệu HozenDX” ở menu trái; đọc lần lượt ba thẻ phạm vi.'},
    {chapter:1,role:'maintenance',page:'integration',selector:'#integration-asset',title:'Tra lý lịch theo mã máy',text:'Chọn mã máy để xem model máy, khu vực, nguồn, thời điểm cập nhật, lịch sử và mẫu PM. Tình trạng nguồn phải được kiểm tra lại tại hiện trường.',action:'Chọn máy trong ô “Chọn máy”, rồi đọc dữ liệu nguồn bên dưới.'}
  );
  steps.push(...maintenance.filter(s=>s.page!=='dashboard').map(s=>({...s,chapter:1,role:'maintenance'})));
  steps.push({chapter:1,role:'maintenance',page:'dashboard',selector:'[data-action="logout"]',title:'Bàn giao yêu cầu cho chuyên gia',text:'Bấm Đăng xuất demo rồi chọn tài khoản Hải. Yêu cầu hỗ trợ đã ghi vào BM-26031. Khi thao tác tự do trên desktop, cũng có thể bấm thẻ tên cuối menu để đổi tài khoản mà không mất dữ liệu.'});
  signIn('expert',2,'u-hai','Trần Văn Hải');
  const expert=plans.expert.filter(s=>s.page!=='dashboard');
  const supportStart=expert.findIndex(s=>s.title==='Nhận hỗ trợ hiện trường');
  const expertSupport=expert.splice(supportStart);
  steps.push(...shell('expert',2),...expertSupport.map(s=>({...s,chapter:2,role:'expert'})));
  steps.push({chapter:2,role:'expert',page:'proposals',selector:'[data-action="k-new"]',title:'Sau hiện trường: ghi kinh nghiệm để tái sử dụng',text:'Hải có thể ghi tri thức khi rảnh; đây là nguồn thứ nhất của kho. Những gì đã làm trong ca vẫn thuộc nhật ký ca, còn bản tri thức này cần đối chiếu và kiểm duyệt riêng.',action:'Mở “Tri thức của tôi”, rồi bấm “Ghi tri thức mới”.'});
  steps.push(...expert.map(s=>({...s,chapter:2,role:'expert'})));
  steps.push({chapter:2,role:'expert',page:'dashboard',selector:'[data-action="logout"]',title:'Chuyên gia hoàn thành phần xác nhận',text:'Bấm Đăng xuất demo. Quay về người bảo trì để rà báo cáo ca BM-26021 đã có phần đóng góp của chuyên gia. BM-26031 là ca minh họa yêu cầu hỗ trợ; BM-26021 là ca minh họa giai đoạn báo cáo.'});
  signIn('maintenance',3,'u-minh','Nguyễn Minh');
  steps.push(...maintenanceReport.map(s=>({...s,chapter:3,role:'maintenance'})));
  steps.push({chapter:3,role:'maintenance',page:'dashboard',selector:'[data-action="logout"]',title:'Gửi đề xuất sang kiểm duyệt',text:'Bấm Đăng xuất demo. Báo cáo ca và đề xuất tri thức là hai bản ghi riêng; tiếp theo chuyên gia trưởng kiểm tra đề xuất trước khi xuất bản.'});
  signIn('lead',4,'u-anh','Lê Quốc Anh');
  steps.push(...shell('lead',4),...plans.lead.filter(s=>s.page!=='dashboard').map(s=>({...s,chapter:4,role:'lead'})));
  steps.push({chapter:5,page:'login',selector:'.role-options',title:'Khép kín vòng tích lũy tri thức',text:'Người bảo trì ghi ca và báo cáo; chuyên gia tham gia, xác nhận và ghi kinh nghiệm; chuyên gia trưởng duyệt tri thức. Nguồn đã duyệt trở lại màn tra cứu cho ca tiếp theo.'});
  let tour=null,frame=0;
  const q=s=>document.querySelector(s);
  function fresh(){const old=S.db;S.db={schema:3,revision:0,users:[],assets:[],knowledge:[],cases:[],proposals:[],notifications:[],audit:[],drafts:{}};S.seeders.forEach(fn=>fn(S.db));const base=S.db;S.db=old;return base;}
  function fill(name,value){const el=q('#modal [name="'+name+'"]')||q('#main-content [name="'+name+'"]');if(el){if(el.type==='checkbox')el.checked=!!value;else el.value=value;}}
  function scene(st){
    S.db=S.clone(tour.base);S.session.userId=st.page==='login'?null:({maintenance:'u-minh',expert:'u-hai',lead:'u-anh'})[st.role];
    const ids={active:'BM-26031',waiting:'BM-26028',pm:'PM-26012',report:'BM-26021',draft:'DP-026',review:'DP-026',feedback:'DP-027',knowledge:'KN-024'};
    const c=S.db.cases.find(c=>c.id===ids.active),p=S.db.proposals.find(p=>p.id==='DP-026');
    if(st.role==='expert'){p.status='draft';p.authorConfirmed=true;}
    if(st.page==='case'&&st.tab==='sources')c.retrieval={at:S.now(),stale:false,sources:S.db.knowledge.filter(k=>k.family==='Vision').map(k=>({id:k.id,version:k.version}))};
    const needsExpert=st.role==='expert'&&['assignments','case'].includes(st.page);
    if(needsExpert){c.expertId='u-hai';c.support={expertId:'u-hai',status:st.stage||'requested',reason:'Cần xác minh cấu hình sau đổi model; kiểm tra ban đầu chưa khắc phục.',requestedAt:S.now()};}
    if(st.id==='pm'&&st.selector==='[name="abnormality"]'){const pm=S.db.cases.find(x=>x.id===ids.pm);pm.pm[0].status='fail';pm.pm[0].abnormality='Vị trí cảm biến khác hồ sơ chuẩn; cần xác minh.';}
    if(['confirmed-contributions','final-report'].includes(st.stage)){
      const reportCase=S.db.cases.find(x=>x.id===ids.report);
      // The guided scenario shows the prerequisite result of the expert confirmation.
      for(const r of reportCase.rounds){const ev=r.events.filter(e=>e.performedBy==='u-hai');const signature=ev.map(e=>JSON.stringify([e.id,e.type,e.content,e.performedBy,e.performedAt,e.result,e.measurement,e.unit,e.rationale])).join('|');reportCase.confirmations[`${r.id}:u-hai`]={status:'confirmed',signature,by:'u-hai',at:S.now()};}
      if(st.stage==='final-report'){reportCase.reportState='confirmed';reportCase.report.confirmedAt=S.now();reportCase.report.confirmedBy='u-minh';}
    }
    S.ui={page:st.page==='login'?'dashboard':st.page,id:ids[st.id]||null,tab:st.tab,menuOpen:false};S.render();
    if(st.page==='login'){const el=q(`[name="account"][value="${st.account||'u-minh'}"]`);if(el)el.checked=true;return;}
    const data={case:ids[st.id]||ids.active,id:ids[st.id]||ids.draft};
    const call=(action,extra={})=>S.actions[action]?.({dataset:{...data,...extra}});
    if(st.modal==='source')call('case-source-read',{source:'KN-024',version:'2'});
    if(st.modal==='support'){call('case-support');fill('reason','Lỗi còn sau kiểm tra ban đầu; cần chuyên gia đối chiếu cấu hình sau đổi model.');}
    if(st.modal==='outcome'){call('case-outcome');fill('evidence','Hiện tượng vẫn còn sau kiểm tra.');fill('machineState','unrestored');fill('next','parts');fill('nextSteps','Chờ linh kiện và kế hoạch kiểm chứng.');}
    if(st.modal==='report')call('case-report-generate');
    if(st.modal==='structure')call('k-structure');
    if(st.modal==='submit')call('k-submit-preview');
    if(st.modal==='join')call('case-support-join');
    if(st.modal==='group')call('case-group-modal');
    if(st.modal==='confirm')call('case-report-confirm-open');
    if(st.modal==='finalize')call('case-report-finalize');
    if(st.modal==='case-proposal')S.createCaseProposal(S.db.cases.find(x=>x.id===ids.report));
    if(st.modal==='decision'){fill('decision','approve');fill('feedback','Đủ căn cứ trong phạm vi mô phỏng; đã nêu điều kiện và giới hạn.');fill('reviewConfirmed',true);S.forms['k-decision'](q('[data-form="k-decision"]'));}
  }
  function clean(){cancelAnimationFrame(frame);q('#tour-layer')?.remove();document.querySelectorAll('.tour-target').forEach(el=>el.classList.remove('tour-target'));q('#app')?.removeAttribute('inert');const modal=q('#modal');modal.removeAttribute('inert');modal.classList.remove('tour-dialog');document.body.classList.remove('tour-running');}
  function finish(){if(!tour)return;const old=tour;tour=null;clean();S.closeModal();S.db=old.db;S.ui=old.ui;S.session.userId=old.userId;S.commit=old.commit;S.go=old.go;S.savedAt=old.savedAt;S.render();history.replaceState(null,'',old.url);scrollTo(0,old.scroll);q('[data-action="tour-start"]')?.focus();}
  function layout(){if(!tour)return;const target=q('.tour-target'),ring=q('#tour-ring'),panel=q('.tour-panel');if(!target||!ring)return;const r=target.getBoundingClientRect(),limit=panel.getBoundingClientRect().top-8;const left=Math.max(4,r.left-5),top=Math.max(4,r.top-5);Object.assign(ring.style,{left:left+'px',top:top+'px',width:Math.max(12,Math.min(innerWidth-4,r.right+5)-left)+'px',height:Math.max(12,Math.min(limit,r.bottom+5)-top)+'px'});}
  function instruction(st,el){
    if(st.action)return st.action;
    if(st.page==='login'&&st.selector.includes('[value='))return 'Chọn tài khoản được khoanh sáng trong cổng demo.';
    if(st.selector==='.login-submit')return 'Bấm “Vào bản demo” để mở không gian làm việc.';
    if(st.selector==='#modal .modal-body')return 'Đọc nội dung hộp thoại và đối chiếu từng mục trước khi xác nhận.';
    const button=el.closest('button')||el.querySelector('button[data-action]');
    if(button){const label=(button.getAttribute('aria-label')||button.textContent||'').trim().replace(/\s+/g,' ').slice(0,72);return `Bấm “${label||st.title}” ở vùng đang sáng.`;}
    const field=el.matches('input,textarea,select')?el:el.querySelector('input,textarea,select');
    if(field){const label=field.closest('.field')?.querySelector('label')?.textContent?.trim()||field.getAttribute('aria-label')||st.title;return `Điền hoặc kiểm tra trường “${label}”; lưu theo nút của biểu mẫu.`;}
    return 'Quan sát vùng đang sáng, đọc thông tin rồi bấm Tiếp theo để xem thao tác kế tiếp.';
  }
  function show(index){
    if(!tour)return;clean();S.closeModal();tour.index=index;const st=steps[index];scene(st);
    let target=q(st.selector);if(!target)throw Error('Thiếu vùng trình bày '+index+': '+st.selector+' / '+st.title);
    for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    const action=instruction(st,target);
    if(target.matches('input[type="checkbox"],input[type="radio"]'))target=target.closest('label')||target;
    else if(target.matches('input,textarea,select'))target=target.closest('.field')||target;
    target.classList.add('tour-target');document.body.classList.add('tour-running');
    const modal=q('#modal');if(modal.open){modal.close();modal.setAttribute('open','');modal.classList.add('tour-dialog');}
    const layer=document.createElement('div');layer.id='tour-layer';layer.innerHTML=`<div class="tour-screen"></div><button id="tour-ring" tabindex="-1" aria-label="Xem bước tiếp theo"></button><section class="tour-panel" role="dialog" aria-modal="true" aria-labelledby="tour-title"><div class="tour-heading"><span class="tour-chapter">${S.e(chapters[st.chapter])}</span><span class="tour-count">Bước ${index+1}/${steps.length}</span><button class="icon-btn" data-tour="exit" aria-label="Kết thúc trình bày">${S.icon('close')}</button></div><div class="tour-progress"><span style="width:${(index+1)/steps.length*100}%"></span></div><h2 id="tour-title" tabindex="-1">${S.e(st.title)}</h2><div class="tour-explain"><div class="tour-detail"><span class="tour-detail-label">THAO TÁC TRÊN MÀN HÌNH</span><p>${S.e(action)}</p></div><div class="tour-detail tour-detail-result"><span class="tour-detail-label">HỆ THỐNG HIỂN THỊ · Ý NGHĨA</span><p>${S.e(st.text)}</p></div></div><div class="tour-controls"><button class="btn btn-secondary" data-tour="prev" ${index===0?'disabled':''}>Quay lại</button><label class="sr-only" for="tour-step">Chọn bước</label><select class="select" id="tour-step">${chapters.map((ch,n)=>`<optgroup label="${S.e(ch)}">${steps.map((s,i)=>s.chapter===n?`<option value="${i}" ${i===index?'selected':''}>${i+1}. ${S.e(s.title)}</option>`:'').join('')}</optgroup>`).join('')}</select><button class="btn btn-primary" data-tour="next">${index===steps.length-1?'Hoàn tất':'Tiếp theo'}</button></div><p class="tour-footnote">Trình bày bằng trạng thái mẫu; bấm vùng sáng hoặc Tiếp theo để mô phỏng thao tác. Không ghi dữ liệu làm việc.</p></section>`;
    document.body.append(layer);q('#app').setAttribute('inert','');modal.setAttribute('inert','');
    const advance=()=>index===steps.length-1?finish():show(index+1);
    layer.querySelectorAll('[data-tour]').forEach(el=>el.onclick=()=>el.dataset.tour==='exit'?finish():el.dataset.tour==='prev'?show(Math.max(0,index-1)):advance());q('#tour-ring').onclick=advance;q('#tour-step').onchange=ev=>show(Number(ev.target.value));
    target.scrollIntoView({block:'center',behavior:'instant'});
    frame=requestAnimationFrame(()=>{if(!tour)return;const r=target.getBoundingClientRect(),limit=q('.tour-panel').getBoundingClientRect().top,delta=r.top-Math.max(90,(limit-Math.min(r.height,150))/2);if(target.closest('#modal'))modal.scrollTop+=delta;else window.scrollBy(0,delta);layout();q('#tour-title')?.focus({preventScroll:true});});
  }
  S.actions['tour-start']=()=>{if(tour)return;if(S.unsavedChanges)return S.toast('Lưu hoặc xuất nội dung chưa lưu trước khi trình bày.','warning');tour={db:S.db,ui:{...S.ui},userId:S.session.userId,commit:S.commit,go:S.go,savedAt:S.savedAt,url:location.href,scroll:scrollY,base:fresh(),index:0};S.commit=(fn,message,rerender=true)=>{fn(S.db);if(rerender)S.render();return true;};S.go=(page,id=null,tab=null)=>{S.closeModal();S.ui={page,id,tab};S.render();};show(0);};
  document.addEventListener('keydown',ev=>{if(!tour)return;if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();finish();return;}if(ev.target.tagName!=='SELECT'&&['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();if(ev.key==='ArrowLeft')show(Math.max(0,tour.index-1));else if(tour.index===steps.length-1)finish();else show(tour.index+1);}if(ev.key==='Tab'){const els=[...document.querySelectorAll('.tour-panel button:not(:disabled),.tour-panel select')],i=els.indexOf(document.activeElement);if(i<0||(!ev.shiftKey&&i===els.length-1)||(ev.shiftKey&&i===0)){ev.preventDefault();els[ev.shiftKey?els.length-1:0].focus();}}},true);
  window.addEventListener('resize',layout);window.addEventListener('scroll',layout,true);window.addEventListener('popstate',()=>{if(tour)finish();});
  S.presentation={steps,show,finish,get active(){return !!tour;}};
})();


