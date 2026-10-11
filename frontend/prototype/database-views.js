/* Read current API data for every operational overview; keep browser archives separate. */
(function () {
  'use strict';
  const S=window.SM,h=S.escape;
  const roles={maintenance:'Người bảo trì',expert:'Chuyên gia',lead:'Chuyên gia trưởng'};
  const pages=new Set(['dashboard','assignments','integration']);
  let generation=0;
  let responding=false;
  const originalGuard=S.guardLeave;
  S.guardLeave=next=>{if(responding){S.toast('Đang lưu phản hồi hỗ trợ. Vui lòng chờ.','info');return false;}return originalGuard(next);};
  S.actions['support-respond']=async button=>{
    if(responding) return;
    const userId=S.user()?.id;responding=true;button.disabled=true;
    try {
      const me=await S.backend.session();
      if(S.user()?.id!==userId) throw new Error('Tài khoản đã thay đổi.');
      const body={expectedCaseDataRevision:Number(button.dataset.revision),decision:button.dataset.decision};
      button._operation=button._operation||crypto.randomUUID();
      await S.backend.api('/api/support-requests/'+encodeURIComponent(button.dataset.request)+'/respond',{method:'POST',headers:{'X-CSRF-Token':me.csrfToken,'Idempotency-Key':button._operation},body:JSON.stringify(body)});
      S.toast('Đã lưu phản hồi vào database.','success');
      responding=false;S.render();
    } catch(error) {S.toast(error.message,'danger');} finally {responding=false;if(button.isConnected) button.disabled=false;}
  };
  function invitationCards(items) {
    const statuses={pending:'Chờ phản hồi',accepted:'Đã nhận hỗ trợ',declined:'Đã từ chối',cancelled:'Đã hủy'};
    return items.length?`<section class="stack"><h2>Yêu cầu hỗ trợ</h2>${items.map(r=>`<article class="source-card stack"><strong>${h(r.title)} · ${h(statuses[r.status])}</strong><p>${h(r.asset_id)} · ${h(r.requestedByName)} → ${h(r.expertName)}</p><p class="workspace-copy">${h(r.message)}</p>${r.status==='pending'&&r.expert_id===S.user().id?`<div class="actions">${[['accepted','Nhận hỗ trợ'],['declined','Từ chối']].map(([decision,label])=>`<button type="button" class="btn btn-secondary" data-action="support-respond" data-request="${h(r.id)}" data-decision="${decision}" data-revision="${r.caseDataRevision}">${label}</button>`).join('')}</div>`:r.status==='accepted'?link('Mở hồ sơ hỗ trợ','db-case',r.case_id):''}</article>`).join('')}</section>`:'';
  }
  const link=(label,page,id='',tab='')=>`<button type="button" class="btn btn-secondary" data-action="navigate" data-page="${h(page)}" data-id="${h(id)}" data-tab="${h(tab)}">${h(label)}</button>`;
  const refresh=()=>'<button type="button" class="btn btn-secondary" data-action="database-refresh">Tải lại dữ liệu</button>';
  const cards=items=>`<div class="grid-2">${items.map(c=>S.caseCard(c).replaceAll('data-action="case-open"','data-action="case-open" data-storage="database"')).join('')}</div>`;
  const events=c=>c.rounds.flatMap(r=>r.events);
  const metric=(label,value,key)=>`<article class="stat-card" data-metric="${key}" data-value="${value}"><span class="metric-label">${h(label)}</span><div class="metric-value">${value}</div></article>`;
  const head=(title,description)=>`<div class="page-head"><div><div class="eyebrow">${h(roles[S.user()?.role])}</div><h1>${h(title)}</h1><p class="subtext">${h(description)}</p></div><div class="actions">${refresh()}</div></div>`;
  function shell(title,description) {return head(title,description)+'<div id="database-view" aria-live="polite"><p>Đang tải dữ liệu máy chủ…</p></div>';}
  S.pages.dashboard={...S.pages.dashboard,render:()=>'<div id="database-view" aria-live="polite">Đang tải tổng quan…</div>'};
  S.pages.assignments={...S.pages.assignments,render:()=>shell('Hỗ trợ & xác nhận','Hồ sơ bạn đã được cấp quyền tham gia và các ghi nhận cần xác nhận.')};
  S.pages.integration={...S.pages.integration,render:()=>shell('Dữ liệu HozenDX','Dữ liệu máy đọc qua adapter của máy chủ; HozenDX hiện vẫn được mô phỏng.')};
  function dashboard(items,assets,proposals,knowledge) {
    return S.visual.dashboard({cases:items,proposals:proposals.map(p=>({...p,...p.content,title:p.content.title,family:'CNC',origin:'case',version:p.revision})),knowledge:knowledge.map(k=>({...k,status:'published',family:'CNC',kind:'case',content:{symptom:k.sections?.[0]?.text||''}}))});
  }
  function assignments(items) {
    const userId=S.user().id;
    return items.length?`<div class="grid-2">${items.map(c=>{
      const pending=events(c).filter(e=>e.performedBy===userId&&e.confirmationStatus!=='confirmed').length;
      return `<section class="stack">${S.caseCard(c).replaceAll('data-action="case-open"','data-action="case-open" data-storage="database"')}<div class="notice notice-${pending?'warning':'info'}">${pending?`${pending} ghi nhận của bạn đang chờ xác nhận.`:'Không có ghi nhận của bạn đang chờ xác nhận.'} ${link('Mở nhật ký & xác nhận','db-case',c.id)}</div></section>`;
    }).join('')}</div>`:S.empty('Chưa có hồ sơ tham gia','Hồ sơ được cấp quyền trên máy chủ sẽ xuất hiện tại đây.');
  }
  function integration(assets,sources,items) {
    return assets.length?`<div class="notice notice-info">HozenDX mô phỏng · chưa kết nối nhà máy · chưa ghi trả.</div><div class="stack">${sources.map(source=>{
      const a=source.data.asset,history=source.data.history||[],references=source.data.documentReferences||[];
      const related=items.filter(c=>c.assetId===a.id);
      return `<section class="card"><div class="card-head"><h2>${h(a.id)} · ${h(a.name)}</h2>${S.badge('HozenDX mô phỏng','blue')}</div><div class="card-body grid-2"><dl class="kv-list">${[['Model máy',a.machineModel],['Nhà chế tạo',a.maker],['Line',a.line],['Năm lắp đặt',a.year],['Thời điểm nguồn',source.provenance?.acquiredAt?S.fmtDate(source.provenance.acquiredAt):'Chưa xác minh']].map(([label,value])=>`<div><dt>${h(label)}</dt><dd>${h(value??'Chưa có')}</dd></div>`).join('')}</dl><div><h3>Hồ sơ SmartMaint đã lưu</h3><div class="stack">${related.length?related.map(c=>link(c.title,'db-case',c.id)).join(''):'<p>Không có hồ sơ trong phạm vi tham gia.</p>'}</div></div></div><div class="card-body grid-2"><div><h3>Lịch sử từ nguồn HozenDX</h3>${history.map(x=>`<div class="source-card"><strong>${h(x.id)}</strong><p>${h(x.summary)}</p></div>`).join('')||'<p>Chưa có lịch sử.</p>'}</div><div><h3>Tài liệu tham chiếu</h3>${references.map(x=>`<div class="source-card"><strong>${h(x.title)}</strong><p>${h(x.summary)}</p><span class="source-meta">${h(x.id)} · ${h(x.version||'Chưa rõ phiên bản')}</span></div>`).join('')||'<p>Chưa có tài liệu.</p>'}</div></div></section>`;
    }).join('')}</div>`:S.empty('Chưa được cấp quyền máy','Chỉ hiển thị máy được máy chủ cấp quyền cho tài khoản hiện tại.');
  }
  async function load(target,page) {
    const request=++generation,userId=S.user()?.id;
    const current=()=>target.isConnected&&request===generation&&S.user()?.id===userId&&S.ui.page===page;
    try {
      const me=await S.backend.session();if(!current()) return;
      const [cases,assets]=await Promise.all([S.backend.api('/api/cases'),S.backend.api('/api/assets')]);
      const support=page==='assignments'||page==='dashboard'?await S.backend.api('/api/support-requests'):{items:[]};
      const sources=page==='integration'?await Promise.all(assets.items.map(a=>S.backend.api('/api/integration/hozendx/assets/'+encodeURIComponent(a.id)))):[];
      const proposals=page==='dashboard'?await S.backend.api('/api/knowledge-proposals'):{items:[]};
      const knowledge=page==='dashboard'?await S.backend.api('/api/knowledge'):{items:[]};
      const verified=await S.backend.api('/api/auth/me');
      if(!current()) return;
      if(verified.user.id!==me.user.id||verified.user.id!==userId) throw new Error('Tài khoản máy chủ đã thay đổi. Tải lại dữ liệu để tiếp tục.');
      target.innerHTML=`<p class="save-state" data-database-loaded="${h(userId)}">Đã đọc dữ liệu máy chủ · ${h(S.fmtDate(new Date().toISOString()))}</p>`+invitationCards(support.items)+(page==='dashboard'?dashboard(cases.items,assets.items,proposals.items,knowledge.items):page==='assignments'?assignments(cases.items):integration(assets.items,sources,cases.items));
    } catch(error) {if(current()) target.innerHTML=`<div class="notice notice-warning" role="alert">${h(error.message)} ${refresh()}</div>`;}
  }
  // Prototype knowledge/review flows remain explicitly labelled until their backend workflow is implemented.
  for(const name of ['library','knowledge-detail','proposals','proposal','review','review-detail','notifications']) {
    const page=S.pages[name];if(!page) continue;
    const render=page.render;
    page.render=()=>'<div class="notice notice-info">Màn hình mô phỏng trên trình duyệt. Chức năng này chưa đồng bộ database; hồ sơ công việc và nhật ký dùng mục Hồ sơ công việc.</div>'+render();
  }
  const render=S.render;
  S.render=()=>{
    render();
    const target=document.querySelector('#database-view');
    if(target) {const label=document.querySelector('[data-save-state]');if(label) label.textContent='Dữ liệu đọc từ máy chủ';load(target,S.ui.page);}
  };
  function reloadVisible() {
    if(document.visibilityState==='hidden'||!pages.has(S.ui.page)||!S.user()||document.querySelector('dialog[open]')||S.backend.isWriting()||responding) return;
    const target=document.querySelector('#database-view');if(target) load(target,S.ui.page);
  }
  window.addEventListener('focus',reloadVisible);
  document.addEventListener('visibilitychange',reloadVisible);
  S.startRoute();
})();
