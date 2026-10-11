/* Canonical database views for curated knowledge, proposal versions and independent review. */
(function(){
  'use strict';
  const S=window.SM,h=S.escape;
  const labels={draft:'Bản nháp',pending:'Chờ duyệt',changes:'Cần bổ sung',rejected:'Đã từ chối',approved:'Đã duyệt',queued:'Chờ đưa vào RAG',building:'Đang tạo embedding',failed:'Cần thử xuất bản lại',ready:'Đã đưa vào RAG'};
  const fields={symptom:'Hiện tượng',context:'Điều kiện áp dụng',cause:'Nguyên nhân',solution:'Biện pháp đã thực hiện',result:'Kết quả',evidence:'Bằng chứng',followUp:'Theo dõi tiếp',limits:'Giới hạn áp dụng'};
  const pages=new Set(['library','knowledge-detail','proposals','proposal','review','review-detail']);
  let generation=0,writing=false,dirty=false;
  const nav=(label,page,id='')=>`<button type="button" class="btn btn-secondary" data-action="navigate" data-page="${h(page)}" data-id="${h(id)}">${h(label)}</button>`;
  const error='<div class="error-summary" role="alert" hidden></div>';
  const guard=S.guardLeave;
  S.guardLeave=next=>{
    if(writing){S.toast('Đang lưu hoặc tạo embedding. Vui lòng chờ.','info');return false;}
    if(dirty&&!window.confirm('Đề xuất chưa lưu. Bạn muốn bỏ thay đổi?'))return false;
    const allowed=guard(next);if(allowed)dirty=false;return allowed;
  };
  window.addEventListener('beforeunload',event=>{if(writing||dirty){event.preventDefault();event.returnValue='';}});
  S.actions['knowledge-refresh']=()=>{if(S.guardLeave(()=>S.render()))S.render();};
  S.actions['k-open']=button=>S.go('knowledge-detail',button.dataset.id);
  S.actions['k-library']=()=>S.go('library');
  const titles={library:'Kho tri thức',proposals:'Bài học từ ca',proposal:'Chi tiết đề xuất',review:'Kiểm duyệt tri thức','review-detail':'Đối chiếu và duyệt','knowledge-detail':'Tri thức đã xuất bản'};
  for(const page of pages) S.pages[page]={...S.pages[page],render:()=>`<div class="page-head"><div><h1>${titles[page]}</h1></div><button type="button" class="btn btn-secondary" data-action="knowledge-refresh">Tải lại</button></div><div id="knowledge-api-view" class="stack" aria-live="polite">Đang tải database…</div>`};
  function contentView(content){return Object.entries(fields).map(([key,label])=>`<section><h3>${label}</h3><p class="workspace-copy">${h(content[key])}</p></section>`).join('');}
  let libraryItems=[],libraryQuery='';
  const normalized=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function libraryView(items){
    const filtered=items.filter(k=>!libraryQuery||normalized([k.id,k.title,...(k.sections||[]).map(s=>s.text)].join(' ')).includes(normalized(libraryQuery)));
    return `<form class="card library-search-panel" data-form="database-library-search"><div class="library-search-inner"><div class="library-search-bar-row"><div class="library-search-input-box"><span class="search-box-icon">${S.icon('search')}</span><input name="query" class="search-main-input" value="${h(libraryQuery)}" placeholder="Nhập từ khóa tra cứu (ví dụ: rung trục chính, model máy, mã lỗi...)" aria-label="Từ khóa tìm kiếm"></div><button type="submit" class="btn btn-primary">Tìm kiếm</button></div><p class="source-meta">Nguồn đã qua kiểm duyệt · CNC · Có phiên bản và căn cứ</p></div></form><section class="library-results"><div class="library-results-head"><div><h2>Nguồn có thể tham khảo</h2><p class="subtext">Nguồn đã qua kiểm duyệt, kèm điều kiện áp dụng và phiên bản.</p></div><span class="library-result-count">${filtered.length}<span>nguồn</span></span></div>${filtered.length?'<div class="library-grid">'+filtered.map(k=>S.visual.libraryCard({...k,kind:'case',family:'CNC',content:{symptom:k.sections?.[0]?.text||''},tags:k.keywords||[]})).join('')+'</div>':S.empty('Chưa có nguồn phù hợp','Tri thức xuất hiện sau khi được duyệt và xuất bản.')}</section>`;
  }
  S.forms['database-library-search']=form=>{libraryQuery=new FormData(form).get('query').trim();const target=document.querySelector('#knowledge-api-view');target.innerHTML=libraryView(libraryItems);};
  function proposalCard(p){return S.visual.proposalRow({...p,...p.content,title:p.content.title,origin:'case',family:'CNC',version:p.revision},S.user().role==='lead');}
  function proposalView(p){
    const editable=p.authorId===S.user().id&&['draft','changes'].includes(p.status);
    const input=(name,label,value,max=8000,required=true)=>`<label class="field">${label}<textarea class="textarea" name="${name}" maxlength="${max}" ${required?'required':''} data-input="knowledge-dirty">${h(value)}</textarea></label>`;
    return `<div class="actions">${S.badge(labels[p.status])}<span>${h(p.id)} · v${p.revision}</span>${nav('Về danh sách',S.user().role==='lead'?'review':'proposals')}</div><h2>${h(p.content.title)}</h2><p>Tác giả: ${h(p.authorName)} · ${h(p.assetId)} · Báo cáo ${h(p.sourceReportId)} v${p.sourceReportRevision}</p><details><summary>Đối chiếu báo cáo đã xác nhận</summary>${Object.entries(p.sourceReport||{}).map(([key,value])=>`<p class="workspace-copy"><strong>${h(key)}:</strong> ${h(value)}</p>`).join('')}</details>${p.decisions.map(d=>`<div class="notice notice-info">v${d.proposal_revision} · ${h(labels[d.decision])}: ${h(d.feedback)}</div>`).join('')}${editable?`<form class="card card-body stack" data-form="knowledge-edit" data-id="${h(p.id)}" data-revision="${p.revision}">${error}${input('title','Tiêu đề',p.content.title,300)}${input('keywords','Từ khóa, phân tách bằng dấu phẩy',p.content.keywords.join(', '),970)}${Object.entries(fields).map(([key,label])=>input(key,label,p.content[key],key==='limits'?4000:8000,!['evidence','followUp'].includes(key))).join('')}<label class="field">Trạng thái nguyên nhân<select name="causeStatus" class="select" data-input="knowledge-dirty">${[['unknown','Chưa rõ'],['hypothesis','Giả thuyết'],['confirmed','Đã xác nhận']].map(([value,label])=>`<option value="${value}" ${p.content.causeStatus===value?'selected':''}>${label}</option>`).join('')}</select></label>${input('rationale','Lý do đề xuất',p.rationale,4000)}<div class="actions"><button class="btn btn-secondary" type="submit">Lưu nháp</button><button class="btn btn-primary" type="submit" value="submit">Gửi kiểm duyệt</button></div></form>`:`<section class="card card-body stack">${contentView(p.content)}<p>Trạng thái nguyên nhân: ${h({unknown:'Chưa rõ',hypothesis:'Giả thuyết',confirmed:'Đã xác nhận'}[p.content.causeStatus])}</p></section>`}${p.canReview&&p.status==='pending'?`<form id="review-knowledge" class="card card-body stack" data-form="knowledge-review" data-id="${h(p.id)}" data-revision="${p.revision}">${error}<p>Đối chiếu báo cáo nguồn, bằng chứng và giới hạn áp dụng trước khi duyệt.</p>${input('feedback','Nhận xét kiểm duyệt','',4000)}<label class="check-line"><input type="checkbox" required> Tôi đã đối chiếu nội dung và báo cáo nguồn.</label><div class="actions"><button class="btn btn-primary" type="submit" value="approved">Duyệt & đưa vào RAG</button><button class="btn btn-secondary" type="submit" value="changes">Yêu cầu bổ sung</button><button class="btn btn-secondary" type="submit" value="rejected">Từ chối</button></div></form>`:S.user().role==='lead'&&p.status==='pending'?'<div class="notice notice-warning">Không đủ điều kiện duyệt độc lập cho đề xuất này.</div>':''}${p.publication?`<section class="card card-body stack"><h3>Xuất bản vào RAG</h3><p>${h(p.publication.id)} · ${h(labels[p.publication.index_status])}</p>${p.publication.active_version?nav('Đọc tri thức đã xuất bản','knowledge-detail',p.publication.id):'<p>Chưa xuất bản: nội dung chưa xuất hiện trong kết quả tra cứu.</p>'}${S.user().role==='lead'&&!p.publication.active_version?`<form data-form="knowledge-publish" data-id="${h(p.publication.id)}" data-proposal="${h(p.id)}">${error}<button type="submit" class="btn btn-primary">Đưa vào RAG / thử lại</button></form>`:''}</section>`:''}<details><summary>Lịch sử phiên bản đề xuất</summary>${(p.versions||[]).map(v=>`<article class="source-card stack"><strong>v${v.revision} · ${h(S.fmtDate(v.createdAt))}</strong><h3>${h(v.content.title)}</h3>${contentView(v.content)}</article>`).join('')}</details>`;
  }
  async function load(target,page,id){
    const request=++generation,userId=S.user()?.id;
    const current=()=>target.isConnected&&generation===request&&S.user()?.id===userId&&S.ui.page===page&&S.ui.id===id;
    try{
      const me=await S.backend.session();if(!current())return;
      const url=page==='library'?'/api/knowledge':page==='knowledge-detail'?'/api/knowledge/'+encodeURIComponent(id):['proposals','review'].includes(page)?'/api/knowledge-proposals':'/api/knowledge-proposals/'+encodeURIComponent(id);
      const data=await S.backend.api(url),verified=await S.backend.api('/api/auth/me');
      if(!current())return;
      if(verified.user.id!==userId||verified.user.id!==me.user.id)throw new Error('Tài khoản đã thay đổi. Tải lại dữ liệu.');
      let html;
      if(page==='library'){
        libraryItems=data.items;
        html=libraryView(data.items);
      }
      else if(page==='knowledge-detail')html=`<div class="actions">${nav('Về kho tri thức','library')}${S.badge('Đã duyệt và xuất bản','green')}</div><h2>${h(data.title)}</h2><p>${h(data.id)}@${h(data.version)} · Nguồn: ${h(data.sourceReportId)} v${data.sourceReportRevision}</p>${data.sections.map(s=>`<article class="source-card"><h3>${h(s.heading)}</h3><small>${h(data.id)}@${h(data.version)}#${h(s.id)}</small><p class="workspace-copy">${h(s.text)}</p></article>`).join('')}`;
      else if(['proposals','review'].includes(page)){const items=page==='review'?data.items.filter(p=>p.status==='pending'||p.publication&&!p.publication.active_version):data.items;html=items.length?`<section class="card dashboard-card"><div class="card-scroll-body">${items.map(proposalCard).join('')}</div></section>`:S.empty(page==='review'?'Không có đề xuất chờ duyệt':'Chưa có đề xuất từ báo cáo','Mở hồ sơ có báo cáo đã xác nhận để tạo đề xuất tri thức.');}
      else html=proposalView(data);
      target.innerHTML=`<p data-knowledge-loaded="${h(userId)}" class="save-state">Đã đọc máy chủ · ${h(S.fmtDate(new Date().toISOString()))}</p>`+html;
    }catch(error){if(current())target.innerHTML=`<div class="notice notice-warning">${h(error.message)}</div>`;}
  }
  S.inputs['knowledge-dirty']=()=>{dirty=true;};
  async function write(form,url,body,method='POST'){
    const userId=S.user().id,serialized=JSON.stringify(body);
    if(form._serialized!==serialized){form._serialized=serialized;form._operation=crypto.randomUUID();}
    const me=await S.backend.session();
    if(S.user()?.id!==userId)throw new Error('Tài khoản đã thay đổi.');
    return S.backend.api(url,{method,headers:{'X-CSRF-Token':me.csrfToken,'Idempotency-Key':form._operation},body:serialized});
  }
  async function submit(form,task){
    if(writing)return;writing=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const notice=await task();dirty=false;writing=false;S.toast(notice?.text||'Đã lưu vào database.',notice?.tone||'success');S.render();}
    catch(error){const node=form.querySelector('.error-summary');if(node){node.textContent=error.message;node.hidden=false;}else S.toast(error.message,'danger');}
    finally{writing=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  S.forms['knowledge-edit']=(form,event)=>submit(form,async()=>{
    const fd=new FormData(form),content={title:fd.get('title'),keywords:String(fd.get('keywords')).split(',').map(x=>x.trim()).filter(Boolean),causeStatus:fd.get('causeStatus')};
    for(const key of Object.keys(fields))content[key]=fd.get(key);
    await write(form,'/api/knowledge-proposals/'+form.dataset.id,{expectedProposalRevision:Number(form.dataset.revision),content,rationale:fd.get('rationale'),submit:event.submitter?.value==='submit'},'PUT');
  });
  S.forms['knowledge-review']=(form,event)=>submit(form,async()=>{
    const result=await write(form,'/api/knowledge-proposals/'+form.dataset.id+'/review',{expectedProposalRevision:Number(form.dataset.revision),decision:event.submitter.value,feedback:new FormData(form).get('feedback')});
    dirty=false;
    if(result.publication){
      try{await write({},'/api/knowledge/'+result.publication.id+'/publish',{expectedVersion:1});}
      catch(error){return {text:'Đã duyệt. '+error.message,tone:'warning'};}
    }
  });
  S.forms['knowledge-publish']=form=>submit(form,()=>write(form,'/api/knowledge/'+form.dataset.id+'/publish',{expectedVersion:1}));
  const render=S.render;
  S.render=()=>{render();document.querySelector('.nav-item[data-page=review] .count-badge')?.remove();const target=document.querySelector('#knowledge-api-view');if(target){document.querySelector('[data-save-state]').textContent='Tri thức lưu trên máy chủ';load(target,S.ui.page,S.ui.id);}};
  S.startRoute();
})();
