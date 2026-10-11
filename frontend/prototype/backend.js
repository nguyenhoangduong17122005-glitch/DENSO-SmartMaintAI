/* Keep the original SmartMaint shell; mount the API workspace in one page. */
(function () {
  'use strict';
  const S=window.SM;
  const h=S.escape;
  const button=(text,action,attrs='')=>`<button type="button" class="btn btn-secondary" data-action="${action}" ${attrs}>${text}</button>`;
  const localCases=S.pages.cases;
  const localCase=S.pages.case.render;
  let requests=0, writing=false;
  let pendingSession=null;
  const pendingImports=new Map();
  async function api(url,options={}) {
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
    let data;try {data=await response.json();} catch {throw new Error('Máy chủ chưa trả dữ liệu hợp lệ. Mở bản demo tại http://127.0.0.1:8001/.');}
    if(!response.ok) {const error=new Error(data.detail||'Chưa thực hiện được yêu cầu.');error.status=response.status;throw error;}
    return data;
  }
  async function ensureSession() {
    const user=S.user();
    if(!['u-minh','u-hai','u-anh'].includes(user?.id)) throw new Error('Chọn Nguyễn Minh, Trần Văn Hải hoặc Lê Quốc Anh để dùng database demo.');
    try {const me=await api('/api/auth/me');if(me.user.id===user.id) return me;} catch {/* Try the configured demo role picker. */}
    if(S.user()?.id!==user.id) throw new Error('Tài khoản đã thay đổi.');
    const options=await api('/api/auth/options');
    if(S.user()?.id!==user.id) throw new Error('Tài khoản đã thay đổi.');
    if(!options.demoRoleSelection) throw new Error('Phiên backend chưa đúng tài khoản. Đăng nhập tại mục Hồ sơ CNC & tra cứu trước.');
    const me=await api('/api/auth/demo-role',{method:'POST',body:JSON.stringify({role:user.role})});
    if(me.user.id!==user.id) throw new Error('Phiên backend chưa đúng tài khoản đang chọn.');
    return me;
  }
  function session() {
    const userId=S.user()?.id;
    if(pendingSession?.userId===userId) return pendingSession.promise;
    const promise=ensureSession();
    const pending={userId,promise};pendingSession=pending;
    promise.then(()=>{if(pendingSession===pending) pendingSession=null;},()=>{if(pendingSession===pending) pendingSession=null;});
    return promise;
  }
  function ownedLocal() {return S.db.cases.filter(c=>c.ownerId===S.user()?.id&&c.type==='BM'&&c.assetId==='CNC-04');}
  S.backend={api,session,isWriting:()=>writing};
  S.pages['local-cases']={...localCases,title:'Hồ sơ trên trình duyệt',render:()=>'<div class="notice notice-warning">Bản cũ lưu trên trình duyệt này. Hồ sơ CNC BM có thể chuyển vào database bằng nút bên dưới.</div>'+ownedLocal().map(c=>button(`Chuyển ${h(c.id)} vào database`,'import-browser-case',`data-case="${h(c.id)}"`)).join(' ')+localCases.render().replaceAll('data-action="case-open"','data-action="case-open" data-storage="browser"')};
  S.pages.cases={...localCases,render:()=>`<div class="page-head"><div><div class="eyebrow">CÔNG VIỆC BẢO TRÌ</div><h1>Ca bảo trì</h1></div>${S.user()?.role==='maintenance'?S.button('Tạo ca mới','case-new','primary'):''}</div><div id="database-cases" aria-live="polite">Đang tải database…</div>`};
  S.actions['visual-machine']=()=>S.go('integration');
  S.actions['database-refresh']=()=>S.render();
  S.actions['database-legacy']=()=>S.go('local-cases');
  S.actions['case-open']=el=>S.go(el.dataset.storage==='browser'?'local-case':'db-case',el.dataset.case);
  const filteredCases=items=>items.filter(c=>!S.ui.tab||S.ui.tab==='all'||(S.ui.tab==='pending'?c.workState==='ended'&&c.reportState!=='confirmed':c.workState===S.ui.tab));
  function caseFilters(items){return `<section class="case-list-toolbar"><div class="case-list-summary"><div class="case-list-stat-badge"><span class="case-list-total">${filteredCases(items).length}</span></div><div class="case-list-summary-text"><strong class="case-list-title">Ca bảo trì của bạn</strong><span class="case-list-desc">Theo dõi tiến độ xử lý và báo cáo</span></div></div><div class="case-filters-segmented">${[['all','Tất cả'],['active','Đang xử lý'],['waiting','Đang chờ'],['pending','Cần báo cáo'],['ended','Đã kết thúc']].map(([key,label])=>`<button type="button" class="case-filter-pill ${(S.ui.tab||'all')===key?'is-active':''}" data-action="database-case-filter" data-filter="${key}" aria-pressed="${(S.ui.tab||'all')===key}"><span class="filter-name">${label}</span><span class="filter-count-pill">${items.filter(c=>key==='all'||(key==='pending'?c.workState==='ended'&&c.reportState!=='confirmed':c.workState===key)).length}</span></button>`).join('')}</div></section>`;}
  S.actions['database-case-filter']=el=>S.go('cases',null,el.dataset.filter);
  async function loadCases(target) {
    const request=++requests,userId=S.user()?.id;
    try {
      await session();const {items}=await api('/api/cases');const verified=await api('/api/auth/me');
      if(!target.isConnected||request!==requests||S.user()?.id!==userId) return;
      if(verified.user.id!==userId) throw new Error('Tài khoản máy chủ đã thay đổi. Tải lại dữ liệu để tiếp tục.');
      const ids=new Set(items.map(c=>c.id));
      const old=ownedLocal().filter(c=>!ids.has(c.id));
      target.innerHTML=`<p class="save-state">Đã đọc ${items.length} hồ sơ từ máy chủ.</p>${caseFilters(items)}<div class="grid-2 case-grid">${filteredCases(items).map(c=>S.caseCard(c).replaceAll('data-action="case-open"','data-action="case-open" data-storage="database"')).join('')}</div>${items.length?'':S.empty('Chưa có hồ sơ trong phạm vi tài khoản','Tạo hồ sơ CNC BM hoặc chọn đúng người phụ trách.')}<div class="stack">${old.map(c=>`<div class="notice notice-warning"><strong>${h(c.title)}</strong><p>${h(c.id)} đang nằm trên trình duyệt, chưa có trong danh sách database của bạn.</p>${button('Chuyển hồ sơ vào database','import-browser-case',`data-case="${h(c.id)}"`)}</div>`).join('')}</div>`;
    } catch(error) {if(target.isConnected&&S.user()?.id===userId) target.innerHTML=`<div class="notice notice-warning">${h(error.message)} ${button('Thử lại','database-refresh')}</div>`;}
  }
  S.pages['new-case'].render=()=>{
    const d=S.db.drafts[`new-case:${S.user().id}`]||{};
    return `<div class="page-head"><div><h1>Tạo ca mới</h1></div>${button('Quay lại hồ sơ','case-list')}</div><div class="split-layout"><form class="card" data-form="case-create"><div class="card-body stack"><div class="error-summary" role="alert" hidden></div><div class="form-grid"><label class="field"><span class="field-label">Loại công việc</span><select class="select" name="type"><option value="BM">BM · Xử lý sự cố</option></select></label><label class="field"><span class="field-label">Mã máy</span><select class="select" name="assetId"><option value="CNC-04">CNC-04 — Máy gia công CNC</option></select></label>${[['title','Tên công việc'],['alarm','Alarm / mã lỗi nếu có'],['newReason','Lý do mở công việc độc lập']].map(([key,label])=>`<label class="field"><span class="field-label">${label}</span><input class="input" name="${key}" value="${h(d[key]||'')}" data-input="new-case-draft" ${key==='alarm'?'':'required'} maxlength="${key==='title'?300:key==='alarm'?200:2000}"></label>`).join('')}</div><label class="field"><span class="field-label">Hiện tượng quan sát sơ bộ</span><textarea class="textarea" name="symptom" rows="4" required maxlength="4000" data-input="new-case-draft">${h(d.symptom||'')}</textarea><span class="field-hint">Ghi dấu hiệu đang thấy; chưa cần kết luận nguyên nhân.</span></label><label class="check-line"><input type="checkbox" name="machineConfirmed" required> Tôi đã đối chiếu đúng máy CNC-04 trong bản demo.</label><div class="actions"><button type="submit" class="btn btn-primary">Tạo hồ sơ và bắt đầu</button><span class="save-state">Chỉ báo thành công sau khi máy chủ lưu.</span></div></div></form>${S.visual.assetPanel(S.asset('CNC-04')).replace('data-action="case-reference"','data-action="visual-machine"')}</div>`;
  };
  // Keep drafts local; submit is the sole operation that creates a database case.
  S.inputs['new-case-draft']=(el)=>S.commit(()=>{const key=`new-case:${S.user().id}`;S.db.drafts[key]={...S.db.drafts[key],[el.name]:el.value};},null,false);
  S.forms['case-create']=async form=>{
    if(writing) return;
    const f=new FormData(form),userId=S.user()?.id;
    const body={assetId:'CNC-04',type:'BM',title:String(f.get('title')||'').trim(),demoIdentityConfirmed:f.has('machineConfirmed'),existingCaseReason:String(f.get('newReason')||'').trim(),context:{symptom:String(f.get('symptom')||'').trim(),alarm:String(f.get('alarm')||'').trim()}};
    const fingerprint=JSON.stringify(body);
    if(form._fingerprint!==fingerprint) {form._fingerprint=fingerprint;form._operation=crypto.randomUUID();}
    writing=true;form.querySelector('[type=submit]').disabled=true;
    try {
      const me=await session();
      if(S.user()?.id!==userId) throw new Error('Tài khoản đã thay đổi. Hãy tải lại form.');
      const saved=await api('/api/cases',{method:'POST',headers:{'X-CSRF-Token':me.csrfToken,'Idempotency-Key':form._operation},body:fingerprint});
      S.commit(()=>{delete S.db.drafts[`new-case:${userId}`];},null,false);
      S.toast(`Đã lưu ${saved.id} vào database.`,'success');
      writing=false;S.go('db-case',saved.id);
    } catch(error) {S.error(form,error.message);} finally {writing=false;if(form.isConnected) form.querySelector('[type=submit]').disabled=false;}
  };
  S.actions['import-browser-case']=el=>{
    const c=ownedLocal().find(c=>c.id===el.dataset.case);if(!c) return;
    S.modal('Chuyển hồ sơ CNC vào database',`<p>${h(c.id)} · ${h(c.title)}</p><p>Giữ mã hồ sơ, bối cảnh, các đợt và ghi nhận. Bản gốc vẫn còn trên trình duyệt. Báo cáo, trạng thái phục hồi và các xác nhận cũ được giữ trong bản lưu gốc để đối chiếu; trên database bắt đầu ở trạng thái chưa kiểm chứng, báo cáo nháp.</p><div id="import-error" role="alert"></div>`,button('Xác nhận chuyển','confirm-browser-import',`data-case="${h(c.id)}"`));
  };
  S.actions['confirm-browser-import']=async el=>{
    const c=ownedLocal().find(c=>c.id===el.dataset.case);if(!c||writing) return;
    const fingerprint=JSON.stringify({confirmed:true,case:c}),userId=S.user().id;
    if(pendingImports.get(c.id)?.fingerprint!==fingerprint) pendingImports.set(c.id,{fingerprint,key:crypto.randomUUID()});
    writing=true;el.disabled=true;
    try {
      const me=await session();if(S.user()?.id!==userId) throw new Error('Tài khoản đã thay đổi.');
      const saved=await api('/api/browser-cases/import',{method:'POST',headers:{'X-CSRF-Token':me.csrfToken,'Idempotency-Key':pendingImports.get(c.id).key},body:fingerprint});
      S.closeModal();S.toast(`Đã chuyển ${saved.id} vào database.`,'success');writing=false;S.go('db-case',saved.id);
    } catch(error) {const target=document.querySelector('#import-error');if(target) target.textContent=error.message;else S.toast(error.message,'danger');} finally {writing=false;if(el.isConnected) el.disabled=false;}
  };
  S.pages['local-case']={...S.pages.case,title:'Bản lưu hồ sơ cũ',render:()=>{
    const c=S.db.cases.find(c=>c.id===S.ui.id);
    return (c?`<div class="notice notice-warning">Bản lưu cũ trên trình duyệt · chỉ xem. ${ownedLocal().some(x=>x.id===c.id)?button('Chuyển vào database','import-browser-case',`data-case="${h(c.id)}"`):''}</div><div class="actions">${[['context','Bối cảnh'],['work','Nhật ký'],['report','Báo cáo cũ']].map(([tab,label])=>button(label,'archive-tab',`data-case="${h(c.id)}" data-tab="${tab}"`)).join('')}</div>`:'')+'<fieldset disabled class="archive-readonly">'+localCase()+'</fieldset>';
  }};
  S.actions['archive-tab']=el=>S.go('local-case',el.dataset.case,el.dataset.tab);
  S.pages.cnc={title:'Hồ sơ CNC & tra cứu',roles:['maintenance','expert','lead'],render:()=>
    `<section id="backend-workspace"><div class="page-head"><div><div class="eyebrow">CNC · Dữ liệu demo</div><h1>Hồ sơ CNC & tra cứu</h1><p class="subtext">Hồ sơ, nhật ký và tra cứu nguồn lưu ở máy chủ. Tổng quan và danh sách công việc đọc cùng database.</p></div></div><div id="account" class="actions"></div><div id="backend-main" class="workspace-main backend-embedded"><p>Đang tải hồ sơ CNC…</p></div><div id="message" class="workspace-message" role="status" aria-live="polite" hidden></div></section>`};
  const guard=S.guardLeave;
  S.guardLeave=next=>{if(writing) {S.toast('Đang lưu vào database. Vui lòng chờ.','info');return false;}return window.smartMaintWorkspaceCanLeave()&&guard(next);};
  S.pages['db-case']={...S.pages.cnc,title:'Chi tiết hồ sơ CNC'};
  S.pages.case={...S.pages['db-case']};
  const render=S.render;
  S.render=()=>{
    const previous=document.querySelector('#backend-workspace');
    if(previous && !window.smartMaintWorkspaceCanLeave()) return;
    render();
    const list=document.querySelector('#database-cases');
    if(list) {loadCases(list);const label=document.querySelector('[data-save-state]');if(label) label.textContent='Danh sách đọc từ database';}
    const container=document.querySelector('#backend-workspace');
    if(container) {
      const saveLabel=document.querySelector('[data-save-state]');
      if(saveLabel) saveLabel.textContent='Hồ sơ CNC lưu trên máy chủ';
      const user=S.user();
      const supported=['u-minh','u-hai','u-anh'].includes(user?.id);
      if(!supported) {
        container.querySelector('#backend-main').innerHTML='<p>Tài khoản này chưa có lựa chọn phiên backend mẫu. Chọn Nguyễn Minh, Trần Văn Hải hoặc Lê Quốc Anh ở phần đổi tài khoản.</p>';
        return;
      }
      window.mountSmartMaintWorkspace(container,user.role,S.ui.id);
    } else if(S.ui.page==='case' && S.user() && ['u-minh','u-hai'].includes(S.user().id)) {
      const actions=document.querySelector('#main-content .page-head');
      if(actions) actions.insertAdjacentHTML('beforeend',`<button type="button" class="btn btn-secondary" data-action="navigate" data-page="cnc" data-id="${S.e(S.ui.id)}">Tra cứu nguồn CNC</button>`);
    }
  };
  window.addEventListener('beforeunload',event=>{if(writing){event.preventDefault();event.returnValue='';}});
  S.startRoute();
})();
