/* Shared shell, demo sign-in, dashboards and the integration boundary. */
(function () {
  'use strict';
  const S=window.SM, e=S.e, icon=S.icon, badge=S.badge;
  const roles={maintenance:'Người bảo trì',expert:'Chuyên gia',lead:'Chuyên gia trưởng'}, all=Object.keys(roles);
  const goBtn=(label,page,id=null,style='secondary',tab=null)=>`<button type="button" class="btn btn-${style}" data-action="navigate" data-page="${e(page)}" ${id?`data-id="${e(id)}"`:''} ${tab?`data-tab="${e(tab)}"`:''}>${e(label)}</button>`;
  const navs={
    maintenance:[['dashboard','Tổng quan','grid'],['cases','Hồ sơ công việc','wrench'],['library','Kho tri thức','book'],['proposals','Đề xuất từ hồ sơ','file']],
    expert:[['dashboard','Tổng quan','grid'],['assignments','Hỗ trợ hiện trường','users'],['cases','Hồ sơ tham gia','wrench'],['proposals','Tri thức của tôi','edit'],['library','Kho tri thức','book']],
    lead:[['dashboard','Tổng quan','grid'],['review','Kiểm duyệt tri thức','shield'],['library','Kho tri thức','book']]
  };
  const accountIds=['u-minh','u-hai','u-anh'];
  Object.values(navs).forEach(items=>items.push(['cnc','Hồ sơ CNC & tra cứu','search'],['integration','Dữ liệu HozenDX','database']));
  const sidebarPreferenceKey='smartmaint-sidebar-collapsed';
  let sidebarCollapsed=false;
  try { sidebarCollapsed=sessionStorage.getItem(sidebarPreferenceKey)==='true'; } catch (_) { /* Keep the default layout when storage is unavailable. */ }
  const head=(title,action='')=>{
    return `<div class="page-head"><h1 id="page-title">${e(title)}</h1>${action?`<div class="actions">${action}</div>`:''}</div>`;
  };
  S.head=head;
  const currentCases=()=>{const u=S.user();return S.db.cases.filter(c=>u.role==='maintenance'?c.ownerId===u.id:c.expertId===u.id||c.support?.expertId===u.id||c.supportRequest?.expertId===u.id||(c.participants||[]).some(p=>(p.userId||p.id||p)===u.id));};
  const proposalLabels={draft:'Nháp',pending:'Chờ duyệt',changes:'Cần bổ sung',rejected:'Từ chối',published:'Đã duyệt',withdrawn:'Đã lưu trữ'};
  const workLabels={active:'Đang xử lý',waiting:'Đang chờ',ended:'Kết thúc công việc'}, reportLabels={draft:'Nháp',pending:'Chờ xác nhận',changes:'Cần sửa',confirmed:'Đã xác nhận'}, reportTones={draft:'neutral',pending:'amber',changes:'red',confirmed:'green'};
  function workRow(c){
    const a=S.asset(c.assetId),
          needsReport=c.workState==='ended'&&c.reportState!=='confirmed',
          action=c.workState==='active'?'Tiếp tục xử lý':c.workState==='waiting'?'Xem việc đang chờ':needsReport?(c.report?'Hoàn thiện báo cáo':'Tạo báo cáo'):'Xem lịch sử',
          tab=needsReport||c.workState==='ended'?'report':'work',
          next=c.workState==='active'?'Ghi nhật ký hoặc tra cứu nguồn liên quan.':c.workState==='waiting'?'Tiếp tục khi có linh kiện hoặc hỗ trợ.':needsReport?'Kiểm tra và hoàn tất báo cáo.':'Hồ sơ đã hoàn tất.';
    return `<div class="case-row">
      <div class="case-main">
        <div class="case-meta">
          <span class="badge badge-case-id">${e(c.id)}</span>
          ${badge(c.type,c.type==='PM'?'blue':'neutral')}
          ${badge(workLabels[c.workState]||c.workState,c.workState==='ended'?'green':c.workState==='waiting'?'amber':'blue')}
        </div>
        <h3 class="case-title"><button class="text-link" data-action="navigate" data-page="case" data-id="${e(c.id)}" data-tab="${tab}">${e(c.title)}</button></h3>
        <p class="subtext">${e(a?.id||c.assetId)} · ${e(a?.name||'')} / ${e(a?.line||'')}</p>
        <span class="next-action-label">${e(next)}</span>
      </div>
      <div class="case-side">
        <div class="case-report-tag">
          ${badge(reportLabels[c.reportState]||'Nháp',reportTones[c.reportState]||'neutral')}
        </div>
        ${goBtn(action,'case',c.id,'secondary',tab)}
      </div>
    </div>`;
  }
  function proposalRow(p, review) {
    const isPending = p.status === 'pending';
    const isChanges = p.status === 'changes';
    const isDraft = p.status === 'draft';
    const isPublished = p.status === 'published';

    const originLabel = p.origin === 'case'
      ? (p.caseId ? `Từ hồ sơ ${p.caseId}` : 'Từ hồ sơ bảo trì')
      : 'Tri thức chuyên gia';

    const familyLabel = p.family || 'Thiết bị';
    const familyKey = (p.family || '').toLowerCase().replace(/\s+/g, '-');

    const nextAction = review
      ? 'Đọc bối cảnh, căn cứ và nội dung tri thức để duyệt hoặc yêu cầu bổ sung.'
      : isChanges
      ? 'Trưởng nhóm đã phản hồi, cần cập nhật bổ sung dữ kiện.'
      : isDraft
      ? 'Bản nháp đang lưu cục bộ, tiếp tục hoàn thiện biểu mẫu.'
      : isPending
      ? 'Đã gửi, đang trong hàng đợi kiểm duyệt của Trưởng nhóm.'
      : 'Tri thức đã được phê duyệt và đưa vào kho tra cứu.';

    const modeTag = p.mode === 'update'
      ? 'Bổ sung tri thức'
      : p.origin === 'case'
      ? 'Bài học từ ca'
      : 'Tri thức mới';

    const statusTone = isChanges ? 'amber' : isPublished ? 'green' : isPending ? 'blue' : 'neutral';
    const statusText = proposalLabels[p.status] || p.status;
    const actionText = review ? 'Xem xét' : (isDraft || isChanges ? 'Chỉnh sửa' : 'Mở xem');
    const targetPage = review ? 'review-detail' : 'proposal';
    const targetTab = review ? null : (isDraft || isChanges ? 'form' : null);

    return `<div class="case-row proposal-dashboard-row">
      <div class="case-main">
        <div class="case-meta">
          <span class="badge badge-case-id mono">${e(p.id)}</span>
          ${badge(statusText, statusTone)}
          <span class="badge badge-family badge-family--${e(familyKey)}">${e(familyLabel)}</span>
          <span class="badge ${p.origin === 'case' ? 'badge-purple' : 'badge-neutral'}">${e(modeTag)}</span>
        </div>
        <h3 class="case-title">
          <button type="button" class="text-link" data-action="navigate" data-page="${e(targetPage)}" data-id="${e(p.id)}" ${targetTab ? `data-tab="${e(targetTab)}"` : ''}>
            ${e(p.title || 'Đề xuất chưa đặt tên')}
          </button>
        </h3>
        <p class="subtext">
          <span class="author-label">${icon('user')} ${e(S.person(p.authorId))}</span>
          <span class="meta-sep">·</span>
          <span>${e(originLabel)}</span>
          <span class="meta-sep">·</span>
          <span>Cập nhật: ${e(S.fmtDate(p.updatedAt || p.createdAt, false))}</span>
        </p>
        <span class="next-action-label">${icon('alert')} ${e(nextAction)}</span>
      </div>
      <div class="case-side">
        <div class="case-report-tag">
          ${badge(`Bản ${e(p.version || 1)}`, 'neutral')}
        </div>
        ${goBtn(actionText, targetPage, p.id, review ? 'primary' : 'secondary', targetTab)}
      </div>
    </div>`;
  }
  const metrics=items=>`<div class="stat-grid">${items.map(([label,val,caption,i,target])=>{const card=`<div class="row-between"><span class="metric-label">${e(label)}</span><span class="stat-icon">${icon(i)}</span></div><div class="metric-value">${val}</div><p class="source-meta">${e(caption)}</p>`;return target?`<button type="button" class="stat-card stat-card-action" data-action="navigate" data-page="${e(target.page)}" ${target.tab?`data-tab="${e(target.tab)}"`:''} aria-label="${e(label)}: ${val}. ${e(caption)}">${card}</button>`:`<article class="stat-card">${card}</article>`;}).join('')}</div>`;
  function dashboard(){
    const u=S.user(),mine=currentCases(),proposals=S.db.proposals.filter(p=>p.authorId===u.id),pending=S.db.proposals.filter(p=>p.status==='pending'&&p.authorId!==u.id&&!(p.contributors||[]).includes(u.id)),published=S.db.knowledge.filter(k=>k.status==='published');
    let stats,primary,body;
    if(u.role==='maintenance'){
      stats=[['Đang xử lý',mine.filter(c=>c.workState==='active').length,'Ca đang thực hiện','wrench',{page:'cases',tab:'active'}],['Đang chờ',mine.filter(c=>c.workState==='waiting').length,'Chờ linh kiện hoặc hỗ trợ','clock',{page:'cases',tab:'waiting'}],['Cần hoàn tất báo cáo',mine.filter(c=>c.workState==='ended'&&c.reportState!=='confirmed').length,'Công việc đã kết thúc','file',{page:'cases',tab:'pending'}],['Nguồn đã duyệt',published.length,'Tri thức sẵn sàng tra cứu','book',{page:'library'}]];
      const priority={active:0,waiting:1,ended:2},ordered=[...mine].sort((a,b)=>(priority[a.workState]??3)-(priority[b.workState]??3)||b.updatedAt.localeCompare(a.updatedAt));
      const next=ordered.find(c=>c.workState==='active')||ordered.find(c=>c.workState==='waiting')||ordered.find(c=>c.workState==='ended'&&c.reportState!=='confirmed');
      primary=goBtn('Tạo ca mới','new-case',null,'primary');
      body=`<section class="card dashboard-card"><div class="card-head"><h2>${next?'Việc cần làm tiếp':'Ca bảo trì của bạn'}</h2>${goBtn('Tất cả ca','cases')}</div><div class="card-scroll-body">${ordered.length?ordered.map(workRow).join(''):S.empty('Chưa có ca bảo trì','Bắt đầu bằng một ca sự cố BM hoặc kiểm tra định kỳ PM.',primary)}</div></section>`;
    }else if(u.role==='expert'){
      stats=[['Hồ sơ tham gia',mine.length,'Ca có chuyên gia tham gia','users',{page:'cases'}],['Tri thức đang soạn',proposals.filter(p=>['draft','changes'].includes(p.status)).length,'Nháp và bản cần bổ sung','edit',{page:'proposals'}],['Đề xuất chờ duyệt',proposals.filter(p=>p.status==='pending').length,'Đã gửi kiểm duyệt','clock',{page:'proposals'}],['Đóng góp đã xuất bản',published.filter(k=>k.authorId===u.id||(k.contributors||[]).includes(u.id)).length,'Tri thức đã duyệt','book',{page:'library'}]];
      primary=goBtn('Ghi tri thức','proposals',null,'primary');
      body=`<section class="card dashboard-card"><div class="card-head"><h2>Hồ sơ tham gia</h2>${goBtn('Mở hỗ trợ','assignments')}</div><div class="card-scroll-body">${mine.length?mine.map(workRow).join(''):S.empty('Chưa có hồ sơ tham gia','Yêu cầu hỗ trợ mới sẽ xuất hiện tại đây.')}</div></section>`;
    }else{
      stats=[['Đang chờ bạn duyệt',pending.length,'Đề xuất chờ quyết định','shield',{page:'review'}],['Đang yêu cầu bổ sung',S.db.proposals.filter(p=>p.status==='changes').length,'Chờ tác giả cập nhật','edit',{page:'review'}],['Tri thức đã xuất bản',published.length,'Nguồn đã qua kiểm duyệt','book',{page:'library'}],['Từ case thực tế',published.filter(k=>k.kind==='case').length,'Bài học từ ca bảo trì','wrench',{page:'library'}]];
      primary=goBtn('Mở hàng đợi duyệt','review',null,'primary');
      body=`<section class="card dashboard-card"><div class="card-head"><h2>Cần xem xét</h2>${goBtn('Xem hàng đợi','review')}</div><div class="card-scroll-body">${pending.length?pending.map(p=>proposalRow(p,true)).join(''):S.empty('Đã xử lý hết hàng đợi','Đề xuất mới sẽ xuất hiện khi tác giả gửi kiểm duyệt.')}</div></section>`;
    }
    const titles={maintenance:'Tổng quan bảo trì',expert:'Tổng quan chuyên gia',lead:'Tổng quan kiểm duyệt'};
    const summaries={maintenance:'Ca đang phụ trách, báo cáo cần hoàn tất và nguồn tri thức đã duyệt.',expert:'Hồ sơ tham gia, đề xuất tri thức và đóng góp đã xuất bản.',lead:'Đề xuất chờ quyết định và tình trạng kho tri thức.'};
    const recentKnowledge=`<section class="card dashboard-card ${u.role==='expert'?'dashboard-card--half':''}"><div class="card-head"><h2>Tri thức mới cập nhật</h2>${goBtn('Mở kho tri thức','library')}</div><div class="card-scroll-body kb-scroll-body">${published.length?published.map(k=>`
      <article class="kb-item-card" data-action="navigate" data-page="knowledge-detail" data-id="${e(k.id)}">
        <div class="kb-item-head">
          <div class="kb-item-badges">
            <span class="badge badge-case-id">${e(k.id)}</span>
            <span class="badge badge-neutral">v${e(k.version)}</span>
            <span class="badge badge-family badge-family--${e((k.family||'').toLowerCase())}">${e(k.family||'Thiết bị')}</span>
            <span class="badge ${k.kind==='case'?'badge-purple':'badge-blue'}">${k.kind==='case'?'Case đã duyệt':'Chuyên gia'}</span>
          </div>
          <span class="kb-item-date">${icon('clock')} ${e(S.fmtDate(k.updatedAt, false))}</span>
        </div>
        <h3 class="kb-item-title">
          <button type="button" class="kb-title-btn" data-action="navigate" data-page="knowledge-detail" data-id="${e(k.id)}">${e(k.title)}</button>
        </h3>
        ${k.content?.symptom?`<p class="kb-item-snippet">${e(k.content.symptom)}</p>`:''}
        <div class="kb-item-footer">
          <span class="kb-item-author">${icon('user')} ${e(S.person(k.authorId))}</span>
          <span class="kb-item-action-hint">Chi tiết nguồn <span class="kb-arrow-icon" aria-hidden="true">→</span></span>
        </div>
      </article>`).join(''):S.empty('Chưa có tri thức đã duyệt','Nguồn được xuất bản sẽ xuất hiện tại đây.')}</div></section>`;
    const expertProposals=u.role==='expert'?`<section class="card dashboard-card dashboard-card--half"><div class="card-head"><h2>Đề xuất gần đây</h2>${goBtn('Tất cả đề xuất','proposals')}</div><div class="card-scroll-body">${proposals.length?proposals.map(p=>proposalRow(p,false)).join(''):S.empty('Chưa có đề xuất','Các bản nháp và đề xuất đã gửi sẽ xuất hiện tại đây.')}</div></section>`:'';
    return head(titles[u.role],primary)+metrics(stats)+`<div class="dashboard-grid"><div class="stack">${body}</div><aside class="stack">${expertProposals}${recentKnowledge}</aside></div>`;
  }
  function notifications(){
    const items=S.db.notifications.filter(n=>n.userId===S.user().id);
    const hasUnread=items.some(n=>!n.read);
    const actions=`${hasUnread?S.button('Đánh dấu đã đọc','read-all','ghost'):''}<button type="button" class="btn btn-secondary" data-action="notifications-back">${icon('back')} Thoát</button>`;
    return head('Thông báo của bạn',actions)+`<div class="notifications-shell">${items.length?`<div class="notifications-list">${items.map(n=>`
      <article class="notification-card notification-row ${n.read?'':'unread'}" data-id="${e(n.id)}">
        <div class="notification-icon" aria-hidden="true">${icon('bell')}</div>
        <div class="notification-copy">
          <div class="notification-copy-head">
            <h3 class="notification-title">${e(n.title)}</h3>
            ${n.read?'':badge('Chưa đọc','blue')}
          </div>
          <p class="notification-body-text">${e(n.body)}</p>
          <div class="notification-meta">
            <span class="notification-meta-item">${icon('clock')} ${e(S.fmtDate(n.createdAt))}</span>
            <span class="notification-meta-sep">·</span>
            <span class="notification-meta-item">${icon('file')} Hồ sơ liên quan</span>
          </div>
        </div>
        <div class="notification-actions">
          <button type="button" class="btn btn-secondary btn-small notification-action-btn" data-action="open-notification" data-id="${e(n.id)}">
            <span>Xem chi tiết</span>${icon('arrow')}
          </button>
        </div>
      </article>`).join('')}</div>`:`<div class="card">${S.empty('Chưa có thông báo','Thông báo xuất hiện khi hồ sơ hoặc đề xuất có cập nhật.')}</div>`}</div>`;
  }
  function integration(){const a=S.asset(S.ui.integrationAsset||'VIS-01');return head('Dữ liệu máy HozenDX')+`<div class="notice notice-info">${icon('info')}<div><strong>Nguồn tham chiếu cục bộ</strong><p>Chưa kết nối cảnh báo trực tiếp, lịch PM hoặc đồng bộ báo cáo.</p></div></div><div class="grid-3"><section class="card card-body"><span class="eyebrow">Chiều đọc</span><h2>Dữ liệu máy</h2><p class="subtext">Lý lịch, lịch sử BM/PM và tham chiếu quy trình theo mã máy.</p>${badge('Dữ liệu mô phỏng','blue')}</section><section class="card card-body"><span class="eyebrow">Bảo dưỡng định kỳ</span><h2>Mẫu PM nội bộ</h2><p class="subtext">Mẫu cấu hình theo máy. Người bảo trì ghi kết quả thực hiện.</p>${badge('Không giả định API lịch PM')}</section><section class="card card-body"><span class="eyebrow">Chiều ghi trả</span><h2>Chưa cấu hình</h2><p class="subtext">Báo cáo được lưu cục bộ, chưa đồng bộ HozenDX.</p>${badge('Chờ xác minh tích hợp','amber')}</section></div><section class="card"><div class="card-head"><h2>Lý lịch máy</h2><div class="field"><label class="field-label" for="integration-asset">Chọn máy</label><select id="integration-asset" class="select" data-input="integration-asset">${S.db.assets.map(x=>`<option value="${e(x.id)}" ${x.id===a.id?'selected':''}>${e(x.id+' · '+x.name)}</option>`).join('')}</select></div></div><div class="card-body grid-2"><dl class="kv-list">${[['Mã / tên máy',a.id+' · '+a.name],['Model máy',a.model],['Nhà chế tạo',a.maker],['Khu vực',a.line],['Nguồn','HozenDX — dữ liệu mô phỏng'],['Thời điểm nguồn',S.fmtDate(a.sourceAt)],['Tình trạng nguồn',a.sourceState]].map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl><div><h3>Lịch sử từ nguồn</h3>${a.history.length?a.history.map(h=>`<div class="source-card"><span class="source-meta">${e(h.id)} · ${e(h.type)} · ${e(S.fmtDate(h.date,false))}</span><p>${e(h.summary)}</p></div>`).join(''):'<p class="muted">Chưa có lịch sử cho máy này.</p>'}<p class="field-hint">Tình trạng nguồn có thể khác hiện trường. Hồ sơ nguồn chưa mặc nhiên là tri thức đã duyệt.</p></div></div></section><section class="card"><div class="card-head"><h2>Tham chiếu và chế độ PM</h2></div><div class="card-body grid-2"><div>${a.references.map(r=>`<details class="source-card"><summary><strong>${e(r.title)}</strong><span class="source-meta">${e(r.id)} · v${e(r.version)}</span></summary><p>${e(r.summary)}</p></details>`).join('')}</div><div><h3>${e(a.pmTemplate.name)}</h3><p class="source-meta">${e(a.pmTemplate.id)} · Phiên bản ${e(a.pmTemplate.version)}</p><ul>${a.pmTemplate.items.map(i=>`<li>${e(i.label)}</li>`).join('')}</ul></div></div></section>`;}
  S.pages.dashboard={title:'Tổng quan',roles:all,render:dashboard};
  S.pages.notifications={title:'Thông báo',roles:all,render:notifications};
  S.pages.integration={title:'Dữ liệu HozenDX',roles:all,render:integration};
  
  S.actions['notifications-back'] = () => {
    let route = S.prevRoute;
    if (!route) {
      try {
        const saved = sessionStorage.getItem('smartmaint-prev-route');
        if (saved) route = JSON.parse(saved);
      } catch (_) {}
    }
    try { sessionStorage.removeItem('smartmaint-prev-route'); } catch (_) {}
    S.prevRoute = null;
    if (route && route.page && route.page !== 'notifications' && S.allowed(route.page)) {
      S.go(route.page, route.id || null, route.tab || null);
    } else {
      const target = S.prevPage && S.prevPage !== 'notifications' && S.allowed(S.prevPage) ? S.prevPage : 'dashboard';
      S.go(target);
    }
  };
  S.actions['read-all']=()=>S.commit(()=>S.db.notifications.filter(n=>n.userId===S.user().id).forEach(n=>n.read=true),'Đã đánh dấu thông báo là đã đọc.');
  S.actions['open-notification']=el=>{const n=S.db.notifications.find(x=>x.id===el.dataset.id&&x.userId===S.user().id);if(n&&S.commit(()=>n.read=true,'',false)){if(S.allowed(n.route?.page))S.go(n.route.page,n.route.id,n.route.tab);else S.go('notifications');}};
  S.actions['switch-account']=()=>{
    const currentId = S.user().id;
    const bodyHtml = `
      <div class="account-switch-banner">
        ${icon('users')}
        <div>Dữ liệu và tiến độ đã lưu được bảo toàn trên trình duyệt. Chọn tài khoản để chuyển đổi ngữ cảnh làm việc và hồ sơ phân quyền tương ứng.</div>
      </div>
      <div class="account-switch-list">
        ${S.db.users.map(u => {
          const isActive = u.id === currentId;
          const roleClass = u.role === 'maintenance' ? 'role--maintenance' : u.role === 'expert' ? 'role--expert' : 'role--lead';
          const roleBadgeColor = u.role === 'maintenance' ? 'blue' : u.role === 'expert' ? 'amber' : 'purple';
          return `
            <button type="button" class="account-switch-card ${roleClass} ${isActive ? 'is-active' : ''}" data-action="demo-account" data-id="${e(u.id)}">
              <div class="account-switch-user">
                <span class="account-switch-avatar">${e(u.initials)}</span>
                <div class="account-switch-details">
                  <div class="account-switch-name-row">
                    <strong class="account-switch-name">${e(u.name)}</strong>
                    ${S.badge(roles[u.role] || u.role, roleBadgeColor)}
                  </div>
                  <span class="account-switch-meta">Mã nhân sự: ${e(u.id)} · ${u.role === 'maintenance' ? 'Tổ Bảo trì Hiện trường' : u.role === 'expert' ? 'Chuyên gia Cơ điện / Tự động hoá' : 'Quản lý Duyệt Tri thức'}</span>
                </div>
              </div>
              <div class="account-switch-status">
                ${isActive ? `${icon('check')} <span>Đang dùng</span>` : `${icon('arrow')}`}
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;
    S.modal('Đổi tài khoản sử dụng', bodyHtml, S.button('Đóng', 'close-modal', 'secondary'));
  };
  S.actions['demo-account']=el=>S.login(el.dataset.id);
  S.actions['sidebar-collapse']=()=>{
    sidebarCollapsed=!sidebarCollapsed;
    try { sessionStorage.setItem(sidebarPreferenceKey,String(sidebarCollapsed)); } catch (_) { /* Layout preference remains in memory. */ }
    document.querySelector('.app-shell')?.classList.toggle('sidebar-collapsed',sidebarCollapsed);
    const toggle=document.querySelector('.sidebar-toggle');
    if(toggle){const label=sidebarCollapsed?'Mở rộng menu':'Thu gọn menu';toggle.setAttribute('aria-label',label);toggle.setAttribute('title',label);toggle.setAttribute('aria-pressed',String(sidebarCollapsed));}
  };
  S.actions['export-demo']=()=>S.exportData();
  S.actions['reset-demo']=()=>{
    const bodyHtml = `
      <div class="stack">
        <div class="notice notice-warning">
          ${icon('alert')}
          <div><strong>Lưu ý quan trọng:</strong> Hành động này sẽ hoàn tác tất cả các ca xử lý, bản ghi nhật ký, đề xuất tri thức và cài đặt bạn đã tạo hoặc sửa đổi về trạng thái xuất xưởng demo ban đầu.</div>
        </div>
        <p>Nếu bạn muốn lưu lại các dữ liệu đã nhập trên trình duyệt này, hãy chọn <strong>Xuất dữ liệu dự phòng</strong> trước khi tiếp tục.</p>
        <p class="field-hint">Dữ liệu sau khi khởi tạo lại không thể khôi phục tự động.</p>
      </div>
    `;
    const footerHtml = S.button('Xuất dữ liệu dự phòng', 'export-demo', 'secondary') + S.button('Hủy bỏ', 'close-modal', 'secondary') + S.button('Khởi tạo lại ngay', 'confirm-reset', 'danger');
    S.modal('Khởi tạo lại dữ liệu demo?', bodyHtml, footerHtml);
  };
  S.actions['confirm-reset']=()=>S.resetDemo();
  S.inputs['integration-asset']=(el,event)=>{if(event.type==='change'){S.ui.integrationAsset=el.value;S.render();}};
  S.forms['demo-login']=form=>{const id=new FormData(form).get('account');if(!id)return S.error(form,'Chọn tài khoản để đăng nhập.');S.login(id);};
  function machineDrawing(){return `<svg class="login-illustration" viewBox="0 0 580 280" fill="none" aria-hidden="true"><path d="M30 242h520M65 260h448" stroke="#607783"/><path d="M85 58h245l48 24v158H85z" fill="#304a5a" stroke="#92a6ae" stroke-width="2"/><path d="M330 58v182M85 82h293" stroke="#92a6ae"/><rect x="109" y="101" width="104" height="96" rx="3" fill="#172f3d" stroke="#819aa6"/><rect x="225" y="101" width="82" height="96" rx="3" fill="#172f3d" stroke="#819aa6"/><path d="M160 102v22m-24 0h47v37h-47zM160 161v17m-24 8h49" stroke="#bed2db" stroke-width="3"/><path d="M242 127h48m-48 16h32m-32 16h42" stroke="#7896a5" stroke-width="3"/><path d="M105 218h202" stroke="#9db3bd"/><circle cx="352" cy="106" r="5" fill="#55baae"/><circle cx="352" cy="125" r="5" fill="#c7974f"/><path d="M352 168v30M108 241v13m247-13v13" stroke="#a7bac3" stroke-width="4"/><path d="M378 206h115v34H378z" fill="#3e5867" stroke="#91a8b3"/><path d="M385 218h99m-87-10v28m19-28v28m19-28v28m19-28v28m19-28v28" stroke="#a6b9c1"/><rect x="423" y="93" width="65" height="86" rx="7" fill="#213d4e" stroke="#b4c7d0" stroke-width="2"/><rect x="433" y="104" width="45" height="54" rx="3" fill="#457a80"/><path d="m442 131 8 8 18-19" stroke="#b9ebe3" stroke-width="3"/><circle cx="455" cy="168" r="3" fill="#9bb6c3"/><path d="M380 133h42M418 133v63" stroke="#75969f" stroke-dasharray="5 5"/><rect x="133" y="33" width="91" height="13" rx="3" fill="#F01833"/><path d="M148 46v12m60-12v12" stroke="#bcbfc0"/></svg>`;}
  const loginBars='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="10" width="4" height="11" rx="1"/><rect x="17" y="4" width="4" height="17" rx="1"/></svg>';
  const loginHeadset='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 12h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Zm16 0h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2ZM19 19c0 2-2 3-5 3h-2"/></svg>';
  function login(){return `<main class="login-page" id="main-content"><section class="login-aside"><div class="brand"><img class="login-brand-logo" src="assets/images/logotachnen.png" alt="DENSO"><span class="brand-copy">SmartMaintAI<span>TRI THỨC & BẢO TRÌ</span></span></div><div class="login-story"><span class="eyebrow">Tri thức hôm nay. Năng lực ngày mai.</span><h1>Kinh nghiệm ở lại.<br>Đội ngũ <em>tiến xa.</em></h1><p>Từ kinh nghiệm chuyên gia đến bài học hiện trường, SmartMaint ghi nhận, chắt lọc, lưu giữ và chia sẻ tri thức để cả đội ngũ cùng áp dụng.</p></div><div class="login-stats"><div class="login-stat"><span class="login-stat-icon">${icon('book')}</span><span><strong>01</strong><span>Kho tri thức chung</span></span></div><div class="login-stat"><span class="login-stat-icon">${icon('users')}</span><span><strong>02</strong><span>Luồng đóng góp</span></span></div><div class="login-stat"><span class="login-stat-icon">${loginBars}</span><span><strong>03</strong><span>Vai trò phối hợp</span></span></div></div></section><section class="login-main"><div class="login-card"><header class="login-card-head"><h2>Chọn tài khoản demo</h2><p>Chọn vai trò để vào không gian làm việc</p></header><form data-form="demo-login"><fieldset class="role-options"><legend class="sr-only">Vai trò sử dụng</legend>${accountIds.map((id,i)=>{const u=S.db.users.find(x=>x.id===id);return `<label class="role-option role-option--${e(u.role)}"><input class="login-role-radio" type="radio" name="account" value="${e(u.id)}" ${i===0?'checked':''}><span class="login-avatar" aria-hidden="true">${e(u.initials)}</span><span class="login-role-copy"><strong>${e(roles[u.role])}</strong><span class="source-meta">${e(u.name)} · ${['BT-001','CG-001','PD-001'][i]}</span></span>${icon('chevron')}</label>`;}).join('')}</fieldset><button type="submit" class="btn btn-primary login-submit">Vào bản demo ${icon('arrow')}</button></form><div class="login-help">${loginHeadset}<span>Cần hỗ trợ? <button type="button" data-action="guide-open">Xem hướng dẫn demo</button></span></div>${S.storageProblem?`<div class="notice notice-danger">${e(S.storageProblem)}${S.button('Khởi tạo dữ liệu demo','reset-demo','danger')}</div>`:''}</div></section></main>`;}
  S.actions['login-support']=()=>{
    const bodyHtml = `
      <div class="stack">
        <div class="notice notice-info">
          ${icon('info')}
          <div>Hệ thống <strong>DENSO SmartMaint</strong> đang chạy trong môi trường Plant MES Demo mô phỏng sản xuất.</div>
        </div>
        <dl class="kv-list">
          <dt>Trạng thái hỗ trợ</dt>
          <dd>Thông tin quản trị hệ thống chưa được cấu hình trong bản prototype.</dd>
          <dt>Hướng liên hệ</dt>
          <dd>Vui lòng liên hệ người phụ trách bản demo.</dd>
        </dl>
        <p class="field-hint">Bản prototype không cung cấp số điện thoại, email hoặc địa chỉ hỗ trợ thực tế.</p>
      </div>
    `;
    S.modal('Hỗ trợ tài khoản & Đăng nhập', bodyHtml, S.button('Đã hiểu', 'close-modal', 'primary'));
  };
  S.render=()=>{
    if (S.unsavedChanges && document.querySelector('#app input, #app textarea')) { S.toast('Nội dung chưa lưu vẫn được giữ trên màn hình. Sao chép hoặc xuất trước khi rời trang.', 'warning'); return; }
    const root=document.getElementById('app'),u=S.user();if(!u){root.innerHTML=login();return;}
    if(!S.allowed(S.ui.page))S.ui={...S.ui,page:'dashboard',id:null,tab:null};
    const page=S.pages[S.ui.page],unread=S.db.notifications.filter(n=>n.userId===u.id&&!n.read).length,pending=S.db.proposals.filter(p=>p.status==='pending'&&p.authorId!==u.id&&!(p.contributors||[]).includes(u.id)).length;
    const active=({'case':'cases','db-case':'cases','local-case':'cases','local-cases':'cases','new-case':'cases','proposal':'proposals','knowledge-detail':'library','review-detail':'review'})[S.ui.page]||S.ui.page;
    root.innerHTML=`<div class="app-shell ${S.ui.menuOpen?'menu-open':''} ${sidebarCollapsed?'sidebar-collapsed':''}">
      <button class="sidebar-overlay" data-action="menu" aria-label="Đóng menu"></button>
      <div class="sidebar-brand"><button type="button" class="brand" data-action="navigate" data-page="dashboard" aria-label="DENSO SmartMaintAI · về Tổng quan" title="Về Tổng quan"><img class="sidebar-brand-logo" src="assets/images/logotachnen.png" alt=""><span class="brand-copy">SmartMaintAI<span>TRI THỨC & BẢO TRÌ</span></span></button></div>
      <aside class="sidebar" aria-label="Điều hướng chính">
        <nav class="nav-list">${navs[u.role].map(([id,label,i])=>`<button class="nav-item ${active===id?'active':''}" data-action="navigate" data-page="${id}" aria-label="${e(label)}" title="${e(label)}" ${active===id?'aria-current="page"':''}>${icon(i)}<span class="nav-text">${e(label)}</span>${id==='review'&&pending?`<span class="count-badge">${pending}</span>`:''}</button>`).join('')}</nav>
        <div class="sidebar-bottom">
          <div class="sidebar-collapse-row">
            <button type="button" class="sidebar-toggle" data-action="sidebar-collapse" aria-label="${sidebarCollapsed?'Mở rộng menu':'Thu gọn menu'}" title="${sidebarCollapsed?'Mở rộng menu':'Thu gọn menu'}" aria-pressed="${sidebarCollapsed}">
              <span class="sidebar-toggle-icon">${icon('chevron')}</span>
              <span class="sidebar-toggle-text">Thu nhỏ</span>
            </button>
          </div>
          <div class="user-card">
            <button type="button" class="user-card-main" data-action="switch-account" aria-label="Đổi tài khoản · ${e(u.name)}" title="Đổi tài khoản · ${e(u.name)}">
              <span class="avatar">${e(u.initials)}</span>
              <span class="user-copy">
                <strong>${e(u.name)}</strong>
                <span class="source-meta">${e(roles[u.role])}</span>
              </span>
            </button>
            <button type="button" class="user-logout-btn" data-action="logout" aria-label="Đăng xuất" title="Đăng xuất">
              ${icon('logout')}
            </button>
          </div>
        </div>
      </aside>
      <div class="app-main"><header class="topbar"><div class="breadcrumbs"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Mở menu" aria-expanded="${!!S.ui.menuOpen}">${icon('menu')}</button><strong>${e(page.title)}</strong></div><div class="topbar-actions"><span class="save-state topbar-save-state" data-save-state aria-label="Trạng thái lưu dữ liệu">${S.storageOK?'Demo · HozenDX mô phỏng':'Chưa lưu được'}</span><button class="icon-btn guide-button" data-action="guide-open" aria-label="Hướng dẫn demo" title="Hướng dẫn demo">${icon('help')}<span class="guide-progress-badge" data-guide-progress hidden></span></button><button class="icon-btn notification-button" data-action="navigate" data-page="notifications" aria-label="Thông báo${unread?', '+unread+' chưa đọc':''}">${icon('bell')}${unread?`<span class="notification-count">${unread}</span>`:''}</button></div></header><main id="main-content" class="content">${S.storageProblem?`<div class="notice notice-danger">${e(S.storageProblem)}</div>`:''}${page.render()}</main></div>
    </div>`;
  };
  const renderPage = S.render;
  S.render = () => { renderPage(); const heading=document.querySelector('#main-content h1'); if(heading){heading.id='page-title';heading.tabIndex=-1;} };
  S.startRoute=()=>{S.clearErrors?.();if(!S.user()){S.render();return;}let p;try{p=location.hash.slice(1).split('/').map(decodeURIComponent);}catch(_){p=[];}const[page,id,tab]=p;if(S.ui.page&&S.ui.page!=='notifications'&&page==='notifications'){S.prevRoute={page:S.ui.page,id:S.ui.id,tab:S.ui.tab};S.prevPage=S.ui.page;try{sessionStorage.setItem('smartmaint-prev-route',JSON.stringify(S.prevRoute));}catch(_){}}S.ui={...S.ui,page:S.allowed(page)?page:'dashboard',id:id||null,tab:tab||null,menuOpen:false};S.render();};
  S.persistSeed();S.startRoute();
})();


