/* Same-origin API workspace. Session cookie is HttpOnly; no auth in localStorage. */
(() => {
  'use strict';
  let main, account, host, embedded=false;
  const active = () => host?.isConnected;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roles = {maintenance:'Người bảo trì',expert:'Chuyên gia',lead:'Chuyên gia trưởng'};
  const labels = {unverified:'Chưa kiểm tra',restored:'Đã phục hồi',unrestored:'Chưa phục hồi',active:'Đang làm',waiting:'Đang chờ',ended:'Đã kết thúc',draft:'Bản nháp',pending:'Chờ xác nhận',changes:'Cần bổ sung',confirmed:'Đã xác nhận',legacy:'Lịch sử mẫu',observation:'Hiện tượng',check:'Kiểm tra',hypothesis:'Giả thuyết',action:'Thao tác',result:'Kết quả'};
  const state = {user:null, csrf:null, assets:[], cases:[], current:null, dirty:false, pending:null, busy:false, demoRoleSelection:false};
  const fields = [['alarm','Alarm'],['component','Bộ phận / vị trí'],['mode','Chế độ vận hành'],['productModel','Model sản phẩm'],['speed','Tốc độ / điều kiện'],['shift','Ca làm việc'],['onset','Thời điểm / tần suất'],['environment','Môi trường']];
  let messageTimer;
  function message(text) {
    const node=host?.querySelector('#message')||document.querySelector('#message'); if(!node) return; node.textContent=text; node.hidden=false;
    clearTimeout(messageTimer); messageTimer=setTimeout(()=>{node.hidden=true;},7000);
  }
  async function api(path, options={}) {
    const headers = {'Content-Type':'application/json', ...options.headers};
    if(options.method && options.method !== 'GET' && state.csrf) headers['X-CSRF-Token']=state.csrf;
    const response=await fetch(path,{...options,headers,credentials:'same-origin'});
    const data=response.status===204?null:await response.json();
    if(!response.ok) {
      const error=new Error(typeof data?.detail==='string'?data.detail:'Chưa xử lý được yêu cầu.');
      error.status=response.status;
      if(response.status===401 && state.user) {
        state.csrf=null;
        account.innerHTML=`<button class="btn btn-secondary" data-action="reauth">${state.demoRoleSelection?'Tiếp tục với vai trò hiện tại':'Đăng nhập lại'}</button>`;
        message('Phiên hết hạn. Nội dung đang nhập được giữ; mở lại phiên cùng tài khoản để tiếp tục.');
      }
      throw error;
    }
    return data;
  }
  function loginView(recovery=false) {
    if(state.demoRoleSelection) {
      const choices=[['maintenance','Người bảo trì · Nguyễn Minh','Mở hồ sơ, tra cứu và ghi nhật ký CNC.'],['expert','Chuyên gia · Trần Văn Hải','Tra cứu, ghi nhật ký và xác nhận phần mình thực hiện.'],['lead','Chuyên gia trưởng · Lê Quốc Anh','Xem máy; tài khoản mẫu này chưa được cấp hồ sơ BM-26028.']];
      main.innerHTML=`<section class="card card-body workspace-login stack"><div class="eyebrow">DENSO SmartMaint · Demo</div><h1>${recovery?'Tiếp tục phiên demo':'Chọn vai trò để bắt đầu'}</h1><p>${recovery?'Tiếp tục bằng đúng vai trò đang dùng để giữ phần nhập chưa lưu.':'Chọn vai trò mẫu, không cần nhập tài khoản hoặc mật khẩu.'}</p><form id="demo-role" class="stack"><div class="error-summary" role="alert" hidden></div><label class="field">Vai trò<select class="select" name="role">${choices.filter(([role])=>!recovery||role===state.user.role).map(([role,label])=>`<option value="${role}">${label}</option>`).join('')}</select></label>${recovery?'':choices.map(([,label,description])=>`<p class="workspace-muted"><strong>${label}</strong><br>${description}</p>`).join('')}<button class="btn btn-primary" type="submit">${recovery?'Tiếp tục':'Vào hệ thống'}</button></form><p class="workspace-muted">Dữ liệu mô phỏng · HozenDX mô phỏng</p>${recovery?'<button class="btn btn-secondary" data-action="cancel-reauth">Quay lại phần đang nhập</button>':''}</section>`;
      return;
    }
    main.innerHTML=`<section class="card card-body workspace-login stack"><div class="eyebrow">Backend demo · tài khoản cá nhân</div><h1>${recovery?'Đăng nhập lại':'Vào không gian CNC'}</h1><p class="subtext">${recovery?'Phần nhập chưa gửi được giữ trong bộ nhớ của tab này.':'Dùng tài khoản được tạo bằng lệnh init-demo. Vai trò và quyền do server cấp.'}</p><form id="login" class="stack"><div class="error-summary" role="alert" hidden></div><label class="field">Tài khoản<input class="input" name="username" autocomplete="username" maxlength="80" required ${recovery?`value="${e(state.user.username)}" readonly`:''}></label><label class="field">Mật khẩu<input class="input" type="password" name="password" autocomplete="current-password" maxlength="256" required></label><button class="btn btn-primary" type="submit">Đăng nhập</button></form><p class="workspace-muted">Dữ liệu mô phỏng. Chưa kết nối HozenDX hoặc AIHO.</p>${recovery?'<button class="btn btn-secondary" data-action="cancel-reauth">Quay lại phần đang nhập</button>':'<a href="/prototype-demo">Mở prototype localStorage riêng</a>'}</section>`;
  }
  function accountView() {
    if(embedded) {account.innerHTML=`<span class="badge badge-blue">${e(state.user.name)} · ${e(roles[state.user.role])}</span>`;return;}
    account.innerHTML=`<span>${e(state.user.name)} · ${e(roles[state.user.role])}</span><button class="btn btn-secondary" data-action="logout">${state.demoRoleSelection?'Đổi vai trò':'Đăng xuất'}</button>`;
  }
  function canLeave() { return !state.dirty || window.confirm('Nội dung chưa lưu. Bạn muốn bỏ thay đổi và chuyển màn hình?'); }
  async function dashboard() {
    const [assets,cases]=await Promise.all([api('/api/assets'),api('/api/cases')]);
    state.assets=assets.items; state.cases=cases.items; state.current=null; state.dirty=false; state.pending=null;
    accountView();
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">${e(roles[state.user.role])}</div><h1>CNC · Hồ sơ và dữ liệu máy</h1><p class="subtext">Danh sách được lọc theo quyền ở server. Chọn hồ sơ để đọc hoặc cập nhật bối cảnh.</p></div></div><div class="workspace-grid"><aside class="stack"><section class="card card-body stack"><h2>Máy được cấp quyền</h2>${state.assets.length?state.assets.map(a=>`<button class="btn btn-secondary" data-action="asset" data-id="${e(a.id)}">${e(a.id)} · ${e(a.machineModel)}</button>`).join(''):'<p>Chưa được cấp quyền máy CNC.</p>'}</section><section class="card card-body stack"><h2>Hồ sơ của bạn</h2><div class="workspace-list">${state.cases.length?state.cases.map(c=>`<button class="btn btn-secondary" data-action="case" data-id="${e(c.id)}">${e(c.id)}<small>${e(c.title)}</small></button>`).join(''):'<p class="subtext">Không có hồ sơ trong phạm vi tham gia.</p>'}</div>${state.user.permissions.includes('cases:create')&&state.assets.length?'<button class="btn btn-primary" data-action="new-case">Mở hồ sơ BM demo</button>':''}</section><a href="/prototype-demo">Prototype đầy đủ dùng localStorage</a></aside><section id="detail" class="card card-body stack"><h2>Bắt đầu từ hồ sơ CNC</h2><p>Chọn máy để xem nguồn mock hoặc mở hồ sơ trong phạm vi của bạn.</p><div class="notice notice-info">Nhật ký, yêu cầu hỗ trợ, báo cáo và xác nhận lưu ở backend. RAG dùng nguồn demo; phê duyệt tri thức là bước tiếp theo.</div></section></div>`;
  }
  function contextForm(context, writable) {
    const input=([key,label])=>`<label class="field">${label}<input class="input" name="${key}" maxlength="${key==='environment'?1000:key==='onset'?500:['alarm','shift'].includes(key)?200:300}" value="${e(context[key])}" ${writable?'':'disabled'}></label>`;
    return `<label class="field">Dấu hiệu / hiện tượng<textarea class="textarea" name="symptom" maxlength="4000" required ${writable?'':'disabled'}>${e(context.symptom)}</textarea></label><div class="form-grid">${fields.slice(0,2).map(input).join('')}</div><details><summary>Thông tin bổ sung (tùy chọn)</summary><div class="form-grid">${fields.slice(2).map(input).join('')}</div></details>`;
  }
  function changesForm(changes=[],writable) {
    const groups=['Man','Machine','Material','Method','Measurement','Environment'];
    const labels=['Con người','Máy móc','Vật liệu','Phương pháp','Đo lường','Môi trường'];
    return `<details><summary>Điểm thay đổi 5M1E</summary><div class="stack">${groups.map((group,i)=>{
      const item=changes.find(c=>c.group===group)||{status:'unchecked',detail:''};
      return `<div class="source-card stack" data-change-group="${group}"><label class="field">${labels[i]}<select class="select" ${writable?'':'disabled'}>${[['unchecked','Chưa kiểm tra'],['none','Không thay đổi'],['changed','Có thay đổi']].map(([v,label])=>`<option value="${v}" ${item.status===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Chi tiết<textarea class="textarea" maxlength="2000" ${writable?'':'disabled'}>${e(item.detail)}</textarea></label></div>`;
    }).join('')}</div></details>`;
  }
  async function openCase(id) {
    const data=await api('/api/cases/'+encodeURIComponent(id));
    const workflow=await api('/api/cases/'+encodeURIComponent(id)+'/workflow');
    state.current=data; state.dirty=false; state.pending=null;
    document.querySelector('#detail').innerHTML=`<div><div class="eyebrow">${e(data.id)} · ${e(data.assetId)}</div><h2>${e(data.title)}</h2></div><p class="workspace-muted">Máy: ${e(labels[data.machineState]||data.machineState)} · Công việc: ${e(labels[data.workState]||data.workState)} · Báo cáo: ${e(labels[data.reportState]||data.reportState)}</p><form id="context" class="stack"><div class="error-summary" role="alert" hidden></div>${contextForm(data.context,data.canEditContext)}${changesForm(data.context.changes,data.canEditContext)}<p class="workspace-muted" id="save-state" data-context-revision="${data.contextRevision}">Đã tải hồ sơ.</p><details><summary>Thông tin bản lưu</summary><p class="workspace-muted">Đã đọc bản server · context revision ${data.contextRevision} · data revision ${data.caseDataRevision}</p></details>${data.canEditContext?'<div class="actions"><button class="btn btn-primary" type="submit">Lưu bối cảnh</button><button class="btn btn-secondary" type="button" data-action="refresh-case">Tải lại bản server</button></div>':'<p>Chỉ người bảo trì phụ trách được sửa bối cảnh.</p>'}</form>${searchView(data)}${journalView(data)}`;
    const statusNode=document.createElement('p');statusNode.className='workspace-muted';statusNode.id='rag-status';statusNode.textContent='Đang đọc trạng thái tra cứu…';
    document.querySelector('#detail').insertAdjacentHTML('beforeend',workflowView(data,workflow));
    if(workflow.report?.status==='confirmed'&&data.ownerId===state.user.id) {
      const existing=workflow.proposals.filter(p=>!['rejected','withdrawn'].includes(p.status));
      document.querySelector('#bm-workflow').insertAdjacentHTML('beforeend',`<section class="stack"><h3>Đưa kinh nghiệm vào kho tri thức</h3><p>Báo cáo đã xác nhận là nguồn đề xuất. Tri thức chỉ xuất hiện trong RAG sau khi chuyên gia trưởng duyệt và xuất bản.</p>${existing.length?existing.map(p=>`<button type="button" class="btn btn-secondary" data-action="open-knowledge-proposal" data-id="${e(p.id)}">Mở đề xuất ${e(p.id)}</button>`).join(''):`<form id="create-knowledge-proposal" class="workflow-form stack" data-kind="proposal" data-report-revision="${workflow.report.revision}"><div class="error-summary" role="alert" hidden></div><label class="field">Tiêu đề tri thức<input class="input" name="title" minlength="3" maxlength="300" required value="${e(data.title)}"></label><label class="field">Lý do đề xuất<textarea class="textarea" name="rationale" maxlength="4000" required></textarea></label><button class="btn btn-primary" type="submit">Tạo đề xuất từ báo cáo</button></form>`}</section>`);
    }
    document.querySelector('#source-search').before(statusNode);
    try {
      const status=await api('/api/rag/status');
      if(statusNode.isConnected) statusNode.textContent=
        (status.retrievalMode==='vector'?`Vector: ${status.index.ready?'đã lập chỉ mục '+status.index.chunks+' đoạn':status.index.reason}`:'Tra cứu: từ khóa')+
        ' · '+(status.answerMode==='gemini'?(status.geminiConfigured?'Gemini: đã cấu hình; kết quả mỗi lần gọi hiển thị bên dưới':'Gemini: chưa có API key/model hợp lệ'):'Trả lời: mẫu trích nguồn');
    } catch(_) {if(statusNode.isConnected) statusNode.textContent='Chưa đọc được trạng thái tra cứu.';}
  }
  function searchView(data) {
    return `<section class="source-card stack" aria-labelledby="search-heading"><h3 id="search-heading">Tra cứu tài liệu CNC mẫu</h3><p class="workspace-muted">Tra cứu ngữ nghĩa hoặc từ khóa · Nguồn mô phỏng · Câu trả lời có nhãn chế độ riêng</p><form id="source-search" class="stack"><div class="error-summary" role="alert" hidden></div><label class="field">Bạn muốn tìm gì?<textarea class="textarea" name="query" minlength="3" maxlength="1000" required placeholder="Ví dụ: rung sau thay đồ gá">${e(data.context.symptom.slice(0,1000))}</textarea></label><div class="actions"><button class="btn btn-primary" type="submit">Tra cứu tài liệu</button><button class="btn btn-primary" type="submit" name="intent" value="answer">Trả lời từ nguồn</button><button class="btn btn-secondary" type="button" data-action="use-symptom">Dùng hiện tượng đang nhập</button></div></form><p class="workspace-muted">Tra cứu theo câu hỏi bạn nhập, chưa tự phân tích nhật ký. Tra cứu không lưu thay đổi của hồ sơ.</p><div id="search-results" class="stack" aria-live="polite"></div><div id="answer-results" class="stack" aria-live="polite"></div></section>`;
  }
  function renderResults(data) {
    document.querySelector('#answer-results').replaceChildren();
    const mode=document.createElement('p');mode.className='workspace-muted';
    mode.textContent=({vector_search:'Chế độ: tìm kiếm vector bằng Gemini Embedding',keyword_fallback:'Chế độ: từ khóa dự phòng',keyword_search:'Chế độ: tìm kiếm từ khóa'})[data.retrievalMode||data.mode]||'';
    document.querySelector('#search-results').innerHTML=`<p>${e(data.notice)}</p><p>Kết quả cho: <strong>${e(data.query)}</strong></p>${data.items.length?data.items.map(item=>`<article class="source-card stack"><strong>${e(item.title)}</strong><small>${e(item.citation)} · Nguồn mô phỏng</small><h4>${e(item.heading)}</h4><p class="workspace-copy">${e(item.excerpt)}</p><button class="btn btn-secondary" type="button" data-action="open-source" data-id="${e(item.sourceId)}" data-version="${e(item.version)}">Xem toàn bộ tài liệu mẫu</button><div class="source-full" hidden></div></article>`).join(''):'<p>Chưa tìm thấy nguồn phù hợp trong bộ demo CNC-04. Thử mô tả rõ hiện tượng hoặc kiểm tra lại máy/model; không suy ra rằng sự cố không tồn tại.</p>'}`;
    document.querySelector('#search-results').prepend(mode);
  }
  function renderAnswer(data) {
    renderResults(data);
    const answer=data.answer;
    const statuses={reference_only:'Nội dung tham khảo từ nguồn',answered:'Trả lời từ nguồn',insufficient_evidence:'Chưa đủ bằng chứng để kết luận',no_match:'Chưa có nguồn phù hợp'};
    const sources=new Map(data.evidence.map(item=>[item.citation,item]));
    document.querySelector('#answer-results').innerHTML=`<section class="source-card stack"><h3>${e(statuses[answer.status]||'Nội dung tham khảo')}</h3><p class="workspace-muted">${e(answer.label)}</p>${answer.statements.map(s=>`<article class="source-card stack"><p class="workspace-copy">${e(s.text)}</p>${s.citations.map(c=>{const source=sources.get(c);return source?`<button type="button" class="btn btn-secondary" data-action="open-source" data-id="${e(source.sourceId)}" data-version="${e(source.version)}">Nguồn: ${e(c)}</button>`:'';}).join('')}<div class="source-full" hidden></div></article>`).join('')}${answer.missingInformation.length?`<div><strong>Phần còn thiếu</strong><ul>${answer.missingInformation.map(text=>`<li>${e(text)}</li>`).join('')}</ul></div>`:''}</section>`;
  }
  function journalView(data) {
    const editable=data.workState!=='ended', owner=data.ownerId===state.user.id && state.user.role==='maintenance';
    const active=data.rounds.find(r=>r.state==='active');
    const error='<div class="error-summary" role="alert" hidden></div>';
    const participants=(data.participants||[]).filter(p=>['expert','maintenance'].includes(p.role));
    const inputs=(ev={})=>`<label class="field">Loại ghi nhận<select class="select" name="type">${['observation','check','hypothesis','action','result'].map((t,i)=>`<option value="${t}" ${ev.type===t?'selected':''}>${['Hiện tượng','Kiểm tra','Giả thuyết','Thao tác','Kết quả'][i]}</option>`).join('')}</select></label><label class="field">Nội dung<textarea class="textarea" name="content" maxlength="8000" required>${e(ev.content)}</textarea></label><label class="field">Người thực hiện<select class="select" name="performedBy">${participants.map(p=>`<option value="${e(p.id)}" ${(ev.performedBy||state.user.id)===p.id?'selected':''}>${e(p.name)}</option>`).join('')}</select></label><label class="field">Kết quả<textarea class="textarea" name="result" maxlength="4000">${e(ev.result)}</textarea></label><details><summary>Thông tin bổ sung (tùy chọn)</summary><div class="form-grid"><label class="field">Số đo (nếu có)<input class="input" type="number" step="any" name="measurement" value="${e(ev.measurement)}"></label><label class="field">Đơn vị<input class="input" name="unit" maxlength="80" value="${e(ev.unit)}"></label></div><label class="field">Cơ sở / lý do<textarea class="textarea" name="rationale" maxlength="4000">${e(ev.rationale)}</textarea></label><label class="field">Thời điểm thực hiện (nếu biết)<input class="input" type="datetime-local" name="occurredAt"></label>${ev.performedAt?`<small>Đang lưu: ${e(ev.performedAt)}. Để trống để giữ thời điểm này.</small>`:'<small>Chưa rõ thời điểm thì để trống; server lưu riêng thời điểm ghi.</small>'}</details>`;
    const events=data.rounds.flatMap(r=>r.events);
    const own=events.filter(ev=>ev.performedBy===state.user.id && ev.confirmationStatus!=='confirmed');
    return `<section class="stack"><h3>Nhật ký theo đợt</h3><p>Một hồ sơ được tiếp tục qua nhiều đợt. Kết thúc đợt chuyển sang chờ, chưa kết thúc công việc.</p>${owner&&editable&&!active?`<form id="start-round" class="journal-form stack">${error}<button class="btn btn-primary" type="submit">Bắt đầu đợt tiếp theo</button></form>`:''}${data.rounds.map(r=>`<section class="source-card stack"><strong>Đợt ${r.number} · ${e(r.id)} · ${e(labels[r.state]||r.state)}</strong><p>${e(r.summary)}${r.nextSteps?`<br>Còn lại: ${e(r.nextSteps)}`:''}</p>${r.state==='legacy'?'<small>Dữ liệu cũ chưa có trạng thái hoặc thời điểm được xác minh.</small>':''}${r.events.map(ev=>`<article class="source-card stack"><strong>${e(ev.id)} · v${ev.revision} · ${e(labels[ev.type]||ev.type)}</strong><p class="workspace-copy">${e(ev.content)}<br>Kết quả: ${e(ev.result)}${ev.measurement!==null?`<br>Số đo: ${e(ev.measurement)} ${e(ev.unit)}`:''}<br>Người làm: ${e(ev.performedBy||'Chưa rõ')} · Người ghi: ${e(ev.recordedBy||'Chưa rõ')}<br>Thực hiện: ${e(ev.performedAt||'Chưa rõ')} · Ghi: ${e(ev.recordedAt||'Chưa rõ')}<br>Xác nhận đóng góp: ${ev.confirmationStatus==='confirmed'?'Đã xác nhận phiên bản này':'Chưa xác nhận phiên bản này'}</p><button class="btn btn-secondary" type="button" data-action="event-history" data-id="${e(ev.id)}">Xem lịch sử phiên bản</button><pre class="event-history" data-history="${e(ev.id)}" hidden></pre>${editable&&[ev.performedBy,ev.recordedBy].includes(state.user.id)?`<details><summary>Đính chính ghi nhận</summary><form class="journal-form stack" id="edit-${e(ev.id)}" data-event="${e(ev.id)}">${error}${inputs(ev)}<label class="field">Lý do đính chính<textarea class="textarea" name="correctionReason" maxlength="2000" required></textarea></label><button class="btn btn-primary" type="submit">Lưu phiên bản mới</button></form></details>`:''}</article>`).join('')}</section>`).join('')}${active&&editable?`<details><summary>Thêm ghi nhận vào đợt đang làm</summary><form id="add-event" class="journal-form stack">${error}${inputs()}<button class="btn btn-primary" type="submit">Lưu ghi nhận</button></form></details>`:''}${owner&&editable&&active?`<details><summary>Kết thúc đợt và bàn giao</summary><form id="end-round" class="journal-form stack">${error}<label class="field">Tóm tắt đã làm<textarea class="textarea" name="summary" maxlength="4000" required></textarea></label><label class="field">Việc còn lại<textarea class="textarea" name="remainingWork" maxlength="4000" required></textarea></label><button class="btn btn-primary" type="submit">Kết thúc đợt, chuyển sang chờ</button></form></details>`:''}${state.user.role==='expert'&&own.length?`<form id="confirm-contributions" class="journal-form stack">${error}<h3>Xác nhận phần mình thực hiện</h3>${own.map(ev=>`<label class="check-line"><input type="checkbox" name="eventIds" value="${e(ev.id)}">${e(ev.id)} · v${ev.revision} · ${e(ev.content)}</label>`).join('')}<button class="btn btn-primary" type="submit">Xác nhận nhóm đã chọn</button></form>`:''}</section>`;
  }
  function workflowView(data,workflow) {
    const owner=data.ownerId===state.user.id&&state.user.role==='maintenance';
    const ended=data.workState==='ended',report=workflow.report,content=report?.content||{};
    const error='<div class="error-summary" role="alert" hidden></div>';
    const statuses={pending:'Chờ phản hồi',accepted:'Đã nhận hỗ trợ',declined:'Đã từ chối',cancelled:'Đã hủy'};
    const experts=workflow.experts.filter(p=>!workflow.requests.some(r=>r.expert_id===p.id&&['pending','accepted'].includes(r.status)));
    const text=(name,label,required=true)=>`<label class="field">${label}<textarea class="textarea" name="${name}" maxlength="${name==='actions'?8000:4000}" ${required?'required':''}>${e(content[name])}</textarea></label>`;
    return `<section id="bm-workflow" class="stack"><h3>Phối hợp chuyên gia</h3>${workflow.requests.map(r=>`<article class="source-card stack"><strong>${e(r.expertName)} · ${e(statuses[r.status])}</strong><p>${e(r.message)}</p>${r.response_note?`<p>Phản hồi: ${e(r.response_note)}</p>`:''}${owner&&!ended&&r.status==='pending'?`<form class="workflow-form" data-kind="cancel-support" data-request="${e(r.id)}">${error}<button type="submit" class="btn btn-secondary">Hủy lời mời đang chờ</button></form>`:''}</article>`).join('')||'<p>Chưa có yêu cầu hỗ trợ trong database.</p>'}${owner&&!ended&&experts.length?`<details><summary>Gửi yêu cầu hỗ trợ</summary><form class="workflow-form stack" id="invite-expert" data-kind="invite">${error}<label class="field">Chuyên gia<select class="select" name="expertId">${experts.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('')}</select></label><label class="field">Nội dung cần hỗ trợ<textarea class="textarea" name="message" maxlength="4000" required></textarea></label><button type="submit" class="btn btn-primary">Gửi yêu cầu hỗ trợ</button></form></details>`:''}<h3>Kết thúc công việc BM</h3>${workflow.closure?`<p>Trạng thái máy: ${e(labels[workflow.closure.machine_state])}</p><p class="workspace-copy">Kết quả kiểm chứng: ${e(workflow.closure.evidence)}</p>`:ended?'<p>Hồ sơ lịch sử đã kết thúc; chưa có bản ghi kiểm chứng theo luồng mới.</p>':owner?`<form id="finish-work" class="workflow-form stack" data-kind="finish">${error}<p>Kết thúc tất cả đợt đang làm và xử lý lời mời đang chờ trước. Kết thúc công việc sẽ khóa sửa nhật ký.</p><label class="field">Trạng thái máy<select class="select" name="machineState"><option value="restored">Đã phục hồi</option><option value="unrestored">Chưa phục hồi</option></select></label><label class="field">Kết quả kiểm chứng / lý do kết thúc<textarea class="textarea" name="evidence" maxlength="4000" required></textarea></label><button type="submit" class="btn btn-primary">Kết thúc công việc</button></form>`:'<p>Người bảo trì phụ trách kết thúc công việc sau khi kiểm chứng.</p>'}<h3>Báo cáo xử lý</h3>${report?`<article class="source-card stack"><strong>Báo cáo v${report.revision} · ${e(labels[report.status])}</strong>${Object.entries({summary:'Tóm tắt',cause:'Nguyên nhân',actions:'Biện pháp',result:'Kết quả',evidence:'Bằng chứng',followUp:'Theo dõi tiếp'}).map(([key,label])=>`<p class="workspace-copy"><strong>${label}:</strong> ${e(content[key])}</p>`).join('')}<p>Trạng thái nguyên nhân: ${e({unknown:'Chưa rõ',hypothesis:'Giả thuyết',confirmed:'Đã xác nhận'}[content.causeStatus])}</p>${report.confirmedAt?`<p>Đã xác nhận: ${e(report.confirmedAt)} · ${e(report.confirmedBy)}</p>`:''}${report.sourceDataRevision!==data.caseDataRevision?'<div class="notice notice-warning">Nguồn đã thay đổi. Người phụ trách cần lưu và gửi lại báo cáo trước khi xác nhận.</div>':''}<button type="button" class="btn btn-secondary" data-action="report-history">Xem các phiên bản báo cáo</button><div id="report-history" hidden></div></article>`:'<p>Chưa lập báo cáo.</p>'}${owner&&ended&&report?.status!=='confirmed'?`<details ${report?'':'open'}><summary>${report?'Chỉnh sửa / cập nhật nguồn báo cáo':'Lập báo cáo'}</summary><form id="bm-report" class="workflow-form stack" data-kind="report">${error}${text('summary','Tóm tắt hiện tượng và xử lý')}${text('cause','Nguyên nhân / phần chưa rõ')}<label class="field">Trạng thái nguyên nhân<select class="select" name="causeStatus">${[['unknown','Chưa rõ'],['hypothesis','Giả thuyết'],['confirmed','Đã xác nhận']].map(([value,label])=>`<option value="${value}" ${content.causeStatus===value?'selected':''}>${label}</option>`).join('')}</select></label>${text('actions','Biện pháp đã thực hiện')}${text('result','Kết quả sau xử lý')}${text('evidence','Bằng chứng xác nhận nguyên nhân',false)}${text('followUp','Việc cần theo dõi tiếp',false)}<div class="actions"><button type="submit" class="btn btn-secondary">Lưu bản nháp</button><button type="submit" value="submit" class="btn btn-primary">Lưu và gửi xác nhận</button></div></form></details>`:''}${owner&&report?.status==='pending'?`<form id="confirm-report" class="workflow-form stack" data-kind="confirm-report" data-revision="${report.revision}">${error}<p>Chuyên gia xác nhận các ghi nhận của mình trước. Người phụ trách xác nhận nội dung báo cáo cuối cùng.</p><label class="check-line"><input type="checkbox" required> Tôi đã đọc và đối chiếu báo cáo v${report.revision}.</label><button type="submit" class="btn btn-primary">Xác nhận báo cáo</button></form>`:''}</section>`;
  }
  async function openAsset(id) {
    const data=await api('/api/integration/hozendx/assets/'+encodeURIComponent(id));
    state.current=null; state.dirty=false; state.pending=null;
    const a=data.data.asset;
    document.querySelector('#detail').innerHTML=`<div class="eyebrow">HozenDX mô phỏng · Chưa đồng bộ</div><h2>${e(a.id)} · ${e(a.name)}</h2><dl><dt>Model máy</dt><dd>${e(a.machineModel)}</dd><dt>Nhà chế tạo</dt><dd>${e(a.maker)}</dd><dt>Line</dt><dd>${e(a.line)}</dd><dt>Thời điểm nguồn</dt><dd>${e(data.provenance.sourceUpdatedAt||'Chưa xác minh')}</dd></dl><div class="notice notice-warning">${data.warnings.map(w=>`<p>${e(w)}</p>`).join('')}</div><h3>Tham chiếu</h3>${data.data.documentReferences.map(d=>`<div class="source-card"><strong>${e(d.id)} · v${e(d.version)}</strong><p>${e(d.summary)}</p><small>Chỉ có tóm tắt; chưa đủ làm nguồn hướng dẫn thao tác.</small></div>`).join('')}<details><summary>Lịch sử và checklist từ mock</summary><pre>${e(JSON.stringify({history:data.data.history,pmTemplate:data.data.pmTemplate},null,2))}</pre></details>`;
  }
  function newCase() {
    state.current=null; state.pending=null; state.dirty=false;
    document.querySelector('#detail').innerHTML=`<h2>Mở hồ sơ BM demo</h2><form id="new-case" class="stack"><div class="error-summary" role="alert" hidden></div><label class="field">Máy<select class="select" name="assetId">${state.assets.map(a=>`<option value="${e(a.id)}">${e(a.id+' · '+a.machineModel)}</option>`).join('')}</select></label><label class="field">Tên công việc<input class="input" name="title" maxlength="300" required></label>${contextForm({},true)}<label class="field">Lý do mở công việc độc lập khi máy đã có hồ sơ chờ<textarea class="textarea" name="existingCaseReason" maxlength="2000"></textarea></label><label class="check-line"><input type="checkbox" name="confirmed" required> Tôi đã xác nhận đúng máy mô phỏng; đây không phải xác minh máy nhà máy.</label><button class="btn btn-primary" type="submit">Tạo hồ sơ</button></form>`;
  }
  function readContext(form) {
    const data=new FormData(form), result={symptom:data.get('symptom'),changes:[...form.querySelectorAll('[data-change-group]')].map(node=>({group:node.dataset.changeGroup,status:node.querySelector('select').value,detail:node.querySelector('textarea').value}))};
    fields.forEach(([key])=>result[key]=data.get(key)); return result;
  }
  function pendingWrite(path, method, body) {
    const serialized=JSON.stringify(body);
    if(!state.pending || state.pending.serialized!==serialized || state.pending.path!==path)
      state.pending={path,method,serialized,key:crypto.randomUUID()};
    return state.pending;
  }
  let recoveryHTML=null;
  document.addEventListener('input',event=>{
    if(!active() || (embedded&&!host.contains(event.target))) return;
    if(event.target.closest('#context, #new-case, .journal-form, .workflow-form')) {
      state.dirty=true;
      const activeForm=event.target.closest('form');
      document.querySelectorAll('#context,.journal-form,.workflow-form').forEach(form=>{form.inert=form!==activeForm;});
      const label=document.querySelector('#save-state'); if(label) label.textContent='Chưa lưu thay đổi lên server';
    }
  });
  document.addEventListener('click',async event=>{
    if(!active() || (embedded&&!host.contains(event.target))) return;
    const button=event.target.closest('[data-action]'); if(!button || state.busy) return;
    if(embedded) {event.preventDefault();event.stopImmediatePropagation();}
    try {
      const action=button.dataset.action;
      if(action==='reauth') {
        // Preserve actual DOM nodes, including unsaved textarea values, in memory.
        recoveryHTML=document.createDocumentFragment(); while(main.firstChild) recoveryHTML.append(main.firstChild);
        loginView(true); return;
      }
      if(action==='cancel-reauth') {main.replaceChildren(recoveryHTML);recoveryHTML=null;return;}
      if(action==='use-symptom') {
        document.querySelector('#source-search [name=query]').value=document.querySelector('#context [name=symptom]').value.slice(0,1000);return;
      }
      if(action==='open-source') {
        const data=await api('/api/cases/'+state.current.id+'/sources/'+encodeURIComponent(button.dataset.id)+'?version='+encodeURIComponent(button.dataset.version));
        const node=button.parentElement.querySelector('.source-full');
        node.innerHTML=`<p class="workspace-muted">${e(data.notice)}</p>${data.sections.map(s=>`<section><h4>${e(s.heading)}</h4><small>${e(data.id+'@'+data.version+'#'+s.id)}</small><p class="workspace-copy">${e(s.text)}</p></section>`).join('')}`;node.hidden=false;return;
      }
      if(action==='event-history') {
        const data=await api('/api/cases/'+state.current.id+'/events/'+button.dataset.id+'/versions');
        const node=[...document.querySelectorAll('[data-history]')].find(n=>n.dataset.history===button.dataset.id);
        node.textContent=JSON.stringify(data.items,null,2);node.hidden=false;return;
      }
      if(action==='report-history') {
        const data=await api('/api/cases/'+state.current.id+'/report/versions');
        const node=document.querySelector('#report-history');
        node.innerHTML=data.items.map(v=>`<article class="source-card"><strong>v${v.revision} · ${e(v.createdAt)}</strong><p>Nguồn hồ sơ: revision ${v.sourceDataRevision}</p>${Object.entries(v.content).map(([key,value])=>`<p class="workspace-copy">${e(key)}: ${e(value)}</p>`).join('')}</article>`).join('');node.hidden=false;return;
      }
      if(!canLeave()) return;
      if(action==='open-knowledge-proposal'&&window.SM) {window.SM.go('proposal',button.dataset.id);return;}
      if(action==='logout') {
        await api('/api/auth/logout',{method:'POST'});
        state.user=null;state.csrf=null;state.current=null;state.dirty=false;state.pending=null;recoveryHTML=null;account.innerHTML='';loginView();return;
      }
      if(action==='case') await openCase(button.dataset.id);
      if(action==='asset') await openAsset(button.dataset.id);
      if(action==='refresh-case') await openCase(state.current.id);
      if(action==='new-case') newCase();
    } catch(error) {message(error.message);}
  },true);
  document.addEventListener('submit',async event=>{
    if(!active() || (embedded&&!host.contains(event.target))) return;
    const form=event.target; if(!['login','demo-role','context','new-case','source-search'].includes(form.id) && !form.classList.contains('journal-form') && !form.classList.contains('workflow-form')) return;
    event.preventDefault(); if(state.busy) return;
    state.busy=true; const button=event.submitter||form.querySelector('[type=submit]'), oldLabel=button.textContent;
    button.disabled=true;button.textContent='Đang xử lý…';
    const errorNode=form.querySelector('.error-summary');errorNode.hidden=true;
    try {
      if(form.id==='login' || form.id==='demo-role') {
        const fd=new FormData(form), previousId=state.user?.id;
        const result=await api(form.id==='demo-role'?'/api/auth/demo-role':'/api/auth/login',{method:'POST',body:JSON.stringify(form.id==='demo-role'?{role:fd.get('role')}:{username:fd.get('username'),password:fd.get('password')})});
        state.user=result.user;state.csrf=result.csrfToken;
        if(recoveryHTML && previousId===result.user.id) {
          main.replaceChildren(recoveryHTML);recoveryHTML=null;accountView();message('Đã đăng nhập lại. Nội dung chưa lưu được giữ; server sẽ kiểm tra quyền và revision khi lưu.');
        } else {recoveryHTML=null;await dashboard();}
      } else if(form.id==='source-search') {
        const body={q:new FormData(form).get('query'),expectedCaseDataRevision:state.current.caseDataRevision};
        document.querySelector('#search-results').replaceChildren();
        document.querySelector('#answer-results').replaceChildren();
        if(event.submitter?.value==='answer') {
          const data=await api('/api/cases/'+state.current.id+'/answer',{method:'POST',body:JSON.stringify(body)});
          renderAnswer(data);
        } else {
          const data=await api('/api/cases/'+state.current.id+'/search?'+new URLSearchParams(body));
          renderResults(data);
        }
      } else if(form.classList.contains('workflow-form')) {
        const fd=new FormData(form),c=state.current,base='/api/cases/'+c.id;
        let path,body={expectedCaseDataRevision:c.caseDataRevision};
        if(form.dataset.kind==='invite') {path=base+'/support-requests';Object.assign(body,{expertId:fd.get('expertId'),message:fd.get('message')});}
        if(form.dataset.kind==='cancel-support') {path='/api/support-requests/'+form.dataset.request+'/respond';body.decision='cancelled';}
        if(form.dataset.kind==='finish') {path=base+'/finish';Object.assign(body,{machineState:fd.get('machineState'),evidence:fd.get('evidence')});}
        if(form.dataset.kind==='report') {path=base+'/report';for(const key of ['summary','cause','causeStatus','actions','result','evidence','followUp']) body[key]=fd.get(key);body.submit=event.submitter?.value==='submit';}
        if(form.dataset.kind==='confirm-report') {path=base+'/report/confirm';body.expectedReportRevision=Number(form.dataset.revision);}
        if(form.dataset.kind==='proposal') {path=base+'/knowledge-proposals';Object.assign(body,{expectedReportRevision:Number(form.dataset.reportRevision),title:fd.get('title'),rationale:fd.get('rationale')});}
        const pending=pendingWrite(path,'POST',body);
        const saved=await api(path,{method:'POST',body:pending.serialized,headers:{'Idempotency-Key':pending.key}});
        if(form.dataset.kind==='proposal'&&window.SM) {state.dirty=false;state.pending=null;state.busy=false;window.SM.go('proposal',saved.id);return;}
        state.dirty=false;state.pending=null;await openCase(c.id);message('Đã lưu bước xử lý BM vào database.');
      } else if(form.classList.contains('journal-form')) {
        const fd=new FormData(form), c=state.current, base='/api/cases/'+c.id;
        const active=c.rounds.find(r=>r.state==='active');
        const previous=form.dataset.event?c.rounds.flatMap(r=>r.events).find(ev=>ev.id===form.dataset.event):null;
        let path, method='POST', body={expectedCaseDataRevision:c.caseDataRevision};
        if(form.id==='start-round') path=base+'/rounds';
        else if(form.id==='end-round') {path=base+'/rounds/'+active.id+'/end';Object.assign(body,{expectedRoundRevision:active.revision,summary:fd.get('summary'),remainingWork:fd.get('remainingWork')});}
        else if(form.id==='confirm-contributions') {
          path=base+'/contribution-confirmations';
          body.items=fd.getAll('eventIds').map(id=>({eventId:id,revision:c.rounds.flatMap(r=>r.events).find(ev=>ev.id===id).revision}));
          if(!body.items.length) throw new Error('Chọn ít nhất một ghi nhận để xác nhận.');
        } else {
          path=previous?base+'/events/'+previous.id:base+'/rounds/'+active.id+'/events';method=previous?'PUT':'POST';
          Object.assign(body,{type:fd.get('type'),content:fd.get('content'),performedBy:fd.get('performedBy'),result:fd.get('result'),rationale:fd.get('rationale'),measurement:fd.get('measurement')===''?null:Number(fd.get('measurement')),unit:fd.get('unit')||null,occurredAt:fd.get('occurredAt')?new Date(fd.get('occurredAt')).toISOString():previous?.performedAt||null});
          if(previous) Object.assign(body,{expectedRevision:previous.revision,correctionReason:fd.get('correctionReason')});
        }
        const pending=pendingWrite(path,method,body);
        await api(path,{method,body:pending.serialized,headers:{'Idempotency-Key':pending.key}});
        state.dirty=false;state.pending=null;await openCase(c.id);message('Đã lưu trên server theo phiên bản.');
      } else {
        const context=readContext(form);
        const fd=new FormData(form);
        const body=form.id==='context'?{expectedContextRevision:state.current.contextRevision,expectedCaseDataRevision:state.current.caseDataRevision,context}:
          {assetId:fd.get('assetId'),title:fd.get('title'),type:'BM',demoIdentityConfirmed:fd.has('confirmed'),existingCaseReason:fd.get('existingCaseReason'),context};
        const pending=pendingWrite(form.id==='context'?'/api/cases/'+state.current.id+'/context':'/api/cases',form.id==='context'?'PUT':'POST',body);
        await api(pending.path,{method:pending.method,body:pending.serialized,headers:{'Idempotency-Key':pending.key}});
        state.dirty=false;state.pending=null;
        // Always reload current server state after a successful replay; its revision may have advanced.
        const id=form.id==='context'?state.current.id:null;
        if(id) await openCase(id); else await dashboard();
        message('Đã lưu lên server.');
      }
    } catch(error) {
      errorNode.textContent=error.message+(error.status===409?' Nội dung đang nhập vẫn được giữ. Sao chép phần cần giữ trước khi tải lại bản server.':'');
      errorNode.hidden=false;
    } finally {state.busy=false;button.disabled=false;button.textContent=oldLabel;}
  });
  window.addEventListener('beforeunload',event=>{if(active()&&state.dirty){event.preventDefault();event.returnValue='';}});
  window.smartMaintWorkspaceCanLeave=()=>{
    if(!active()) return true;
    if(state.busy) {message('Đang xử lý yêu cầu. Chờ hoàn tất trước khi chuyển màn hình.');return false;}
    if(!canLeave()) return false;
    state.dirty=false;return true;
  };
  window.mountSmartMaintWorkspace=async(container=null,role=null,caseId=null)=>{
    embedded=Boolean(container);host=container||document.body;
    main=embedded?host.querySelector('#backend-main'):document.querySelector('#main-content');
    account=host.querySelector('#account');
    state.user=null;state.csrf=null;state.current=null;state.dirty=false;state.pending=null;recoveryHTML=null;
    state.busy=true;
    try {
      const options=await api('/api/auth/options');state.demoRoleSelection=options.demoRoleSelection;
      if(embedded && role && state.demoRoleSelection) {
        const result=window.SM?.backend?await window.SM.backend.session():await api('/api/auth/demo-role',{method:'POST',body:JSON.stringify({role})});
        if(!active()) return;
        state.user=result.user;state.csrf=result.csrfToken;await dashboard();
        if(caseId) {
          if(state.cases.some(c=>c.id===caseId)) await openCase(caseId);
          else main.querySelector('#detail').innerHTML='<h2>Không thể mở hồ sơ</h2><p>Hồ sơ không tồn tại trong database hoặc bạn chưa được cấp quyền tham gia. Hồ sơ cũ trên trình duyệt nằm trong mục Hồ sơ cũ trên trình duyệt.</p>';
        }
        return;
      }
      if(state.demoRoleSelection) {loginView();return;}
      const result=await api('/api/auth/me');state.user=result.user;state.csrf=result.csrfToken;await dashboard();
    }
    catch(error) {if(error.status===401) loginView();else {main.innerHTML='<section class="card card-body"><h1>Chưa tải được backend</h1><p id="startup-error"></p><p>Mở hệ thống tại http://127.0.0.1:8001/ và kiểm tra máy chủ đang chạy.</p><button class="btn btn-secondary" data-action="reload">Thử lại</button></section>';document.querySelector('#startup-error').textContent=error.message;document.querySelector('[data-action=reload]').onclick=()=>location.reload();}}
    finally {state.busy=false;}
  };
  if(document.querySelector('.workspace-header')) window.mountSmartMaintWorkspace();
})();
