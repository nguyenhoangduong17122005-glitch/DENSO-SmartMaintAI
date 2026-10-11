/* Presentation templates from Hoafng3107/Denso_SmartmaintAI (87e755a).
 * They render server snapshots only; all writes remain in the API adapters. */
(function(){
  'use strict';
  const S=window.SM, h=S.escape, e=h, icon=S.icon, badge=S.badge;
  const labels={machine:{unverified:'Chưa đủ kiểm chứng',restored:'Đã phục hồi',unrestored:'Chưa phục hồi'},work:{active:'Đang xử lý',waiting:'Đang chờ / bàn giao',ended:'Đã kết thúc công việc'},report:{draft:'Nháp',pending:'Chờ xác nhận',changes:'Cần cập nhật',confirmed:'Đã xác nhận'}};
  const cid=c=>`data-case="${h(c.id)}"`;
  const events=c=>(c.rounds||[]).flatMap(r=>r.events||[]);
  const sourceTime=a=>S.fmtDate(a?.sourceAt);
  const goBtn=(label,page,id=null,style='secondary',tab=null)=>`<button type="button" class="btn btn-${style}" data-action="navigate" data-page="${e(page)}" ${id?`data-id="${e(id)}"`:''} ${tab?`data-tab="${e(tab)}"`:''}>${e(label)}</button>`;
  const head=(title,action='')=>`<div class="page-head"><h1 id="page-title">${h(title)}</h1><div class="actions">${action}</div></div>`;
  const proposalLabels={draft:'Nháp',pending:'Chờ duyệt',changes:'Cần bổ sung',rejected:'Từ chối',published:'Đã duyệt',approved:'Đã duyệt',withdrawn:'Đã lưu trữ'};
  const workLabels=labels.work,reportLabels=labels.report,reportTones={draft:'neutral',pending:'amber',changes:'red',confirmed:'green'};
  function caseCard(c) {
    const a = S.asset(c.assetId);
    const needsReport = c.workState === 'ended' && c.reportState !== 'confirmed';
    const action = c.workState === 'active' ? 'Tiếp tục xử lý' : c.workState === 'waiting' ? 'Mở ca đang chờ' : needsReport ? (c.report ? 'Hoàn thiện báo cáo' : 'Tạo báo cáo') : 'Xem lịch sử';

    // Contextual next action details
    let nextTitle = 'Bước tiếp theo';
    let nextIcon = 'wrench';
    let nextType = 'active';
    let next = 'Ghi nhật ký, tra cứu nguồn hoặc yêu cầu hỗ trợ.';

    if (c.workState === 'waiting') {
      nextTitle = 'Điểm nghẽn · Đang chờ';
      nextIcon = 'clock';
      nextType = 'waiting';
      next = c.waitingReason || 'Tiếp tục khi có điều kiện xử lý.';
    } else if (needsReport) {
      nextTitle = 'Cần hoàn tất báo cáo';
      nextIcon = 'file';
      nextType = 'report';
      next = 'Công việc đã kết thúc; hoàn tất báo cáo để lưu kết quả.';
    } else if (c.workState === 'ended') {
      nextTitle = 'Hồ sơ đã lưu';
      nextIcon = 'checkcircle';
      nextType = 'ended';
      next = 'Hồ sơ và các đợt kiểm chứng đã được lưu trữ.';
    }

    // Machine state indicator
    const machineMeta = {
      restored: { text: 'Đã phục hồi', cls: 'status-restored', dot: 'dot-restored' },
      unrestored: { text: 'Chưa phục hồi', cls: 'status-unrestored', dot: 'dot-unrestored' },
      unverified: { text: 'Chưa đủ kiểm chứng', cls: 'status-unverified', dot: 'dot-unverified' }
    }[c.machineState] || { text: labels.machine[c.machineState] || c.machineState, cls: 'status-unverified', dot: 'dot-unverified' };

    // Report state indicator
    const reportMeta = {
      draft: { text: 'Bản nháp', cls: 'report-draft', dot: 'dot-draft' },
      pending: { text: 'Chờ xác nhận', cls: 'report-pending', dot: 'dot-pending' },
      changes: { text: 'Cần cập nhật', cls: 'report-changes', dot: 'dot-changes' },
      confirmed: { text: 'Đã xác nhận', cls: 'report-confirmed', dot: 'dot-confirmed' }
    }[c.reportState] || { text: labels.report[c.reportState] || c.reportState, cls: 'report-draft', dot: 'dot-draft' };

    // Work state indicator
    const workMeta = {
      active: { text: 'Đang xử lý', tone: 'active', dot: 'dot-active' },
      waiting: { text: 'Đang chờ / bàn giao', tone: 'waiting', dot: 'dot-waiting' },
      ended: { text: 'Đã kết thúc', tone: 'ended', dot: 'dot-ended' }
    }[c.workState] || { text: labels.work[c.workState] || c.workState, tone: 'active', dot: 'dot-active' };

    const typeTone = c.type === 'PM' ? 'pm' : 'bm';
    const typeLabel = c.type === 'PM' ? 'PM · Định kỳ' : 'BM · Sự cố';
    const expertId = c.expertId || c.support?.expertId;

    return `
    <article class="case-card state-${c.workState} ${c.workState === 'waiting' ? 'is-waiting' : ''}" ${cid(c)}>
      <div class="case-card-body">
        
        <div class="case-card-head">
          <div class="case-card-badges">
            <span class="badge-case-id">${h(c.id)}</span>
            <span class="badge-case-type ${typeTone}">${h(typeLabel)}</span>
            <span class="badge-work-state ${workMeta.tone}">
              <span class="status-pulse-dot ${workMeta.dot}"></span>
              ${h(workMeta.text)}
            </span>
          </div>
          <div class="case-card-report-badge ${reportMeta.cls}" title="Trạng thái báo cáo">
            <span class="status-indicator-dot ${reportMeta.dot}"></span>
            <span>${h(reportMeta.text)}</span>
          </div>
        </div>

        <div class="case-card-main-info">
          <h3 class="case-card-title">
            <button type="button" class="case-card-title-btn" data-action="case-open" ${cid(c)}>
              ${h(c.title)}
            </button>
          </h3>
          <div class="case-asset-banner">
            <span class="badge-asset-id" title="Mã thiết bị">
              ${icon('machine')}
              ${h(a?.id || c.assetId)}
            </span>
            <span class="case-asset-name">${h(a?.name || '')}</span>
            <span class="case-asset-sep">·</span>
            <span class="case-asset-line">${h(a?.line || '')}</span>
          </div>
        </div>

        <div class="case-next-banner is-${nextType}">
          <div class="case-next-icon">
            ${icon(nextIcon)}
          </div>
          <div class="case-next-content">
            <span class="case-next-tag">${h(nextTitle)}</span>
            <p class="case-next-desc">${h(next)}</p>
          </div>
        </div>

        <div class="case-meta-chips">
          <span class="case-chip" title="Số đợt xử lý">
            ${icon('history')}
            <strong>${c.rounds.length}</strong> đợt
          </span>
          <span class="case-chip" title="Số lượt ghi nhận nhật ký">
            ${icon('file')}
            <strong>${events(c).length}</strong> ghi nhận
          </span>
          <span class="case-chip" title="Người phụ trách ca">
            ${icon('user')}
            <span>${h(S.person(c.ownerId))}</span>
          </span>
          ${expertId ? `
          <span class="case-chip case-chip-expert" title="Chuyên gia phối hợp">
            ${icon('users')}
            <span>CG: ${h(S.person(expertId))}</span>
          </span>
          ` : ''}
        </div>

        <div class="case-status-grid">
          <div class="case-status-col">
            <span class="status-col-label">Tình trạng máy</span>
            <div class="status-col-val ${machineMeta.cls}">
              <span class="status-indicator-dot ${machineMeta.dot}"></span>
              <strong>${h(machineMeta.text)}</strong>
            </div>
          </div>
          <div class="case-status-col">
            <span class="status-col-label">Hồ sơ báo cáo</span>
            <div class="status-col-val ${reportMeta.cls}">
              <span class="status-indicator-dot ${reportMeta.dot}"></span>
              <strong>${h(reportMeta.text)}</strong>
            </div>
          </div>
        </div>

        <div class="case-card-footer">
          <button type="button" class="btn btn-primary case-action-btn" data-action="case-open" ${cid(c)}>
            <span>${h(action)}</span>
            ${icon('arrow')}
          </button>
          <div class="case-updated-time">
            ${icon('clock')}
            <span>Cập nhật ${h(S.fmtDate(c.updatedAt))}</span>
          </div>
        </div>

      </div>
    </article>
    `;
  }
  function assetPanel(a) {
    if(!a) return '';
    return `<aside class="asset-telemetry-panel">
      <div class="card asset-telemetry-card">
        <div class="card-head asset-telemetry-head">
          <div class="asset-telemetry-title">
            <span class="asset-head-icon">${icon('machine')}</span>
            <h2>Thông tin máy</h2>
          </div>
          <span class="badge badge-blue asset-system-tag">
            <span class="status-pulse-dot dot-blue"></span>
            HozenDX · Dữ liệu mô phỏng
          </span>
        </div>
        <div class="card-body stack asset-telemetry-body">
          <div class="asset-primary-identity">
            <div class="asset-code-badge">${h(a.id)}</div>
            <div class="asset-name-block">
              <h3 class="asset-machine-name">${h(a.name)}</h3>
              <div class="asset-line-chip">
                <span>${h(a.line)}</span>
                <span class="meta-sep">·</span>
                <span>Năm ${h(a.year)}</span>
              </div>
            </div>
          </div>

          <div class="asset-specs-grid">
            <div class="asset-spec-item">
              <span class="spec-label">Hãng & Model</span>
              <strong class="spec-val">${h(a.maker)} / ${h(a.model)}</strong>
            </div>
            <div class="asset-spec-item">
              <span class="spec-label">Trạng thái dữ liệu</span>
              <strong class="spec-val">${h(a.sourceState || 'Dữ liệu lưu trước')}</strong>
            </div>
            <div class="asset-spec-item span-2">
              <span class="spec-label">Thông số kỹ thuật</span>
              <p class="spec-desc">${h(a.specs)}</p>
            </div>
          </div>

          <div class="asset-sync-strip">
            <div class="sync-dot-label">
              <span class="status-indicator-dot dot-green"></span>
              <span>Lấy dữ liệu lúc: <strong>${h(sourceTime(a))}</strong></span>
            </div>
            <span class="sync-hint">Nguồn tham chiếu; tình trạng thực tế do người thực hiện xác nhận.</span>
          </div>

          <div class="asset-action-box">
            <button type="button" class="btn btn-secondary btn-block asset-doc-btn" data-action="case-reference" data-asset="${h(a.id)}">
              ${icon('book')}
              <span>Lịch sử và tài liệu máy</span>
            </button>
          </div>
        </div>
      </div>
    </aside>`;
  }
  function header(c, selectedTab) {
    const a = S.asset(c.assetId), tab = selectedTab || S.ui.tab || (c.workState === 'ended' ? 'report' : 'work');
    const typeLabel = c.type === 'PM' ? 'PM · Định kỳ' : 'BM · Sự cố';
    const typeTone = c.type === 'PM' ? 'badge-pm' : 'badge-bm';

    const machineConfig = {
      restored: { text: labels.machine.restored, tone: 'tone-success', dot: 'dot-green' },
      unrestored: { text: labels.machine.unrestored, tone: 'tone-warning', dot: 'dot-amber' },
      unverified: { text: labels.machine.unverified, tone: 'tone-neutral', dot: 'dot-neutral' }
    }[c.machineState] || { text: labels.machine[c.machineState] || c.machineState, tone: 'tone-neutral', dot: 'dot-neutral' };

    const workConfig = {
      active: { text: labels.work.active, tone: 'tone-active', dot: 'dot-blue-pulse' },
      waiting: { text: labels.work.waiting, tone: 'tone-warning', dot: 'dot-amber-pulse' },
      ended: { text: labels.work.ended, tone: 'tone-success', dot: 'dot-green' }
    }[c.workState] || { text: labels.work[c.workState] || c.workState, tone: 'tone-neutral', dot: 'dot-neutral' };

    const reportConfig = {
      draft: { text: labels.report.draft, tone: 'tone-neutral', dot: 'dot-neutral' },
      pending: { text: labels.report.pending, tone: 'tone-warning', dot: 'dot-amber-pulse' },
      changes: { text: labels.report.changes, tone: 'tone-purple', dot: 'dot-purple' },
      confirmed: { text: labels.report.confirmed, tone: 'tone-success', dot: 'dot-green' }
    }[c.reportState] || { text: labels.report[c.reportState] || c.reportState, tone: 'tone-neutral', dot: 'dot-neutral' };

    const totalEvents = events(c).length;

    const steps = [
      { key: 'context', num: '1', title: 'Bối cảnh & máy', phase: 'GIAI ĐOẠN 1' },
      { key: 'sources', num: '2', title: 'Tra cứu & căn cứ', phase: 'GIAI ĐOẠN 2' },
      { key: 'work', num: '3', title: 'Xử lý & nhật ký', phase: 'GIAI ĐOẠN 3' },
      { key: 'report', num: '4', title: 'Báo cáo tổng kết', phase: 'GIAI ĐOẠN 4' }
    ];

    return `
    <header class="case-detail-header">
      <div class="case-header-main">
        <div class="case-header-eyebrow">
          <span class="badge-case-id">${h(c.id)}</span>
          <span class="badge-case-type ${typeTone}">${h(typeLabel)}</span>
          ${a?.line ? `<span class="badge-case-line">${h(a.line).toUpperCase()}</span>` : ''}
        </div>
        <h1 id="page-title" class="case-header-title">${h(c.title)}</h1>
        <div class="case-header-meta">
          <span class="meta-item meta-asset" title="Thiết bị liên quan">
            ${icon('machine')}
            <strong>${h(c.assetId)}</strong>
            <span>${h(a?.name || '')}</span>
          </span>
          <span class="meta-sep">·</span>
          <span class="meta-item meta-owner" title="Người phụ trách">
            ${icon('user')}
            <span>Phụ trách: <strong>${h(S.person(c.ownerId))}</strong></span>
          </span>
          ${c.expertId ? `
          <span class="meta-sep">·</span>
          <span class="meta-item meta-expert" title="Chuyên gia phối hợp">
            ${icon('users')}
            <span>Chuyên gia: <strong>${h(S.person(c.expertId))}</strong></span>
          </span>` : ''}
        </div>
      </div>
      <div class="case-header-actions">
        <button type="button" class="btn btn-ghost case-back-btn" data-action="case-list">
          ${icon('back')}
          <span>Quay lại ca bảo trì</span>
        </button>
      </div>
    </header>

    <div class="case-status-strip" role="region" aria-label="Thông số trạng thái ca bảo trì (chỉ đọc)">
      <div class="status-strip-cell">
        <div class="status-strip-label">Tình trạng máy</div>
        <div class="status-strip-value">
          <span class="status-pill status-pill--${machineConfig.tone}">
            <span class="status-pill-dot ${machineConfig.dot}"></span>
            <span>${h(machineConfig.text)}</span>
          </span>
        </div>
      </div>
      <div class="status-strip-cell">
        <div class="status-strip-label">Công việc hiện trường</div>
        <div class="status-strip-value">
          <span class="status-pill status-pill--${workConfig.tone}">
            <span class="status-pill-dot ${workConfig.dot}"></span>
            <span>${h(workConfig.text)}</span>
          </span>
        </div>
      </div>
      <div class="status-strip-cell">
        <div class="status-strip-label">Hồ sơ báo cáo</div>
        <div class="status-strip-value">
          <span class="status-pill status-pill--${reportConfig.tone}">
            <span class="status-pill-dot ${reportConfig.dot}"></span>
            <span>${h(reportConfig.text)}</span>
          </span>
        </div>
      </div>
      <div class="status-strip-cell">
        <div class="status-strip-label">Tiến trình nhật ký</div>
        <div class="status-strip-value">
          <span class="status-pill status-pill--progress">
            ${icon('clock')}
            <span><strong>${c.rounds.length}</strong> đợt <span class="pill-sep">·</span> <strong>${totalEvents}</strong> ghi nhận</span>
          </span>
        </div>
      </div>
    </div>

    <nav class="case-workflow-stepper" aria-label="Quy trình 4 giai đoạn ca bảo trì">
      ${steps.map(s => {
        const isCurrent = tab === s.key;
        return `
        <button type="button" class="case-workflow-step ${isCurrent ? 'is-current' : ''}" 
          ${isCurrent ? 'aria-current="step"' : ''} 
          data-action="case-tab" ${cid(c)} data-tab="${s.key}">
          <div class="step-num-pill">${s.num}</div>
          <div class="step-text-wrap">
            <span class="step-phase-label">${s.phase}</span>
            <strong class="step-title">${h(s.title)}</strong>
          </div>
        </button>
        `;
      }).join('')}
    </nav>
    `;
  }
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
        <h3 class="case-title"><button class="text-link" data-action="navigate" data-page="case" data-storage="database" data-case="${e(c.id)}" data-id="${e(c.id)}" data-tab="${tab}">${e(c.title)}</button></h3>
        <p class="subtext">${e(a?.id||c.assetId)} · ${e(a?.name||'')} / ${e(a?.line||'')}</p>
        <span class="next-action-label">${e(next)}</span>
      </div>
      <div class="case-side">
        <div class="case-report-tag">
          ${badge(reportLabels[c.reportState]||'Nháp',reportTones[c.reportState]||'neutral')}
        </div>
        ${goBtn(action,'case',c.id,'secondary',tab).replace('data-page="case"','data-page="case" data-storage="database" data-case="'+e(c.id)+'"')}
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
      ? 'Bản nháp đã lưu trên máy chủ, tiếp tục hoàn thiện biểu mẫu.'
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
  function dashboard(snapshot){
    const u=S.user(),mine=snapshot.cases,proposals=snapshot.proposals.filter(p=>p.authorId===u.id),pending=snapshot.proposals.filter(p=>p.status==='pending'&&p.authorId!==u.id&&!(p.contributors||[]).includes(u.id)),published=snapshot.knowledge.filter(k=>k.status==='published');
    let stats,primary,body;
    if(u.role==='maintenance'){
      stats=[['Đang xử lý',mine.filter(c=>c.workState==='active').length,'Ca đang thực hiện','wrench',{page:'cases',tab:'active'}],['Đang chờ',mine.filter(c=>c.workState==='waiting').length,'Chờ linh kiện hoặc hỗ trợ','clock',{page:'cases',tab:'waiting'}],['Cần hoàn tất báo cáo',mine.filter(c=>c.workState==='ended'&&c.reportState!=='confirmed').length,'Công việc đã kết thúc','file',{page:'cases',tab:'pending'}],['Nguồn đã duyệt',published.length,'Tri thức sẵn sàng tra cứu','book',{page:'library'}]];
      const priority={active:0,waiting:1,ended:2},ordered=[...mine].sort((a,b)=>(priority[a.workState]??3)-(priority[b.workState]??3)||b.updatedAt.localeCompare(a.updatedAt));
      const next=ordered.find(c=>c.workState==='active')||ordered.find(c=>c.workState==='waiting')||ordered.find(c=>c.workState==='ended'&&c.reportState!=='confirmed');
      primary=goBtn('Tạo ca mới','new-case',null,'primary');
      body=`<section class="card dashboard-card"><div class="card-head"><h2>${next?'Việc cần làm tiếp':'Ca bảo trì của bạn'}</h2>${goBtn('Tất cả ca','cases')}</div><div class="card-scroll-body">${ordered.length?ordered.map(workRow).join(''):S.empty('Chưa có ca bảo trì','Bắt đầu bằng một ca sự cố BM CNC.',primary)}</div></section>`;
    }else if(u.role==='expert'){
      stats=[['Hồ sơ tham gia',mine.length,'Ca có chuyên gia tham gia','users',{page:'cases'}],['Tri thức đang soạn',proposals.filter(p=>['draft','changes'].includes(p.status)).length,'Nháp và bản cần bổ sung','edit',{page:'proposals'}],['Đề xuất chờ duyệt',proposals.filter(p=>p.status==='pending').length,'Đã gửi kiểm duyệt','clock',{page:'proposals'}],['Đóng góp đã xuất bản',published.filter(k=>k.authorId===u.id||(k.contributors||[]).includes(u.id)).length,'Tri thức đã duyệt','book',{page:'library'}]];
      primary=goBtn('Bài học từ ca','proposals',null,'primary');
      body=`<section class="card dashboard-card"><div class="card-head"><h2>Hồ sơ tham gia</h2>${goBtn('Mở hỗ trợ','assignments')}</div><div class="card-scroll-body">${mine.length?mine.map(workRow).join(''):S.empty('Chưa có hồ sơ tham gia','Yêu cầu hỗ trợ mới sẽ xuất hiện tại đây.')}</div></section>`;
    }else{
      stats=[['Đang chờ bạn duyệt',pending.length,'Đề xuất chờ quyết định','shield',{page:'review'}],['Đang yêu cầu bổ sung',snapshot.proposals.filter(p=>p.status==='changes').length,'Chờ tác giả cập nhật','edit',{page:'review'}],['Tri thức đã xuất bản',published.length,'Nguồn đã qua kiểm duyệt','book',{page:'library'}],['Từ case thực tế',published.filter(k=>k.kind==='case').length,'Bài học từ ca bảo trì','wrench',{page:'library'}]];
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
    return head(titles[u.role],primary)+metrics(stats)+`<div class="dashboard-grid" data-metric="open" data-value="${mine.filter(c=>c.workState!=='ended').length}"><div class="stack">${body}</div><aside class="stack" data-metric="events" data-value="${mine.reduce((n,c)=>n+events(c).length,0)}">${expertProposals}${recentKnowledge}</aside></div>`;
  }

  function renderLibraryCard(k) {
    const isCase = k.kind === 'case';
    const kindLabel = isCase ? 'Case đã duyệt' : 'Kinh nghiệm chuyên gia';
    const kindClass = isCase ? 'kind-case' : 'kind-expert';
    const symptom = (k.content?.symptom || '').trim();
    const excerpt = symptom.length > 220 ? symptom.slice(0, 217) + '…' : (symptom || 'Chưa có thông tin dấu hiệu tóm tắt.');
    const assetTag = (k.assetIds && k.assetIds.length) ? k.assetIds[0] : null;

    return `
      <article class="library-card ${kindClass}" data-id="${e(k.id)}">
        <div class="library-card-body">
          
          <div class="library-card-head">
            <div class="library-card-badges">
              <span class="badge-knowledge-id">${e(k.id)}</span>
              <span class="badge-knowledge-kind ${isCase ? 'case' : 'expert'}">
                <span class="kind-bullet"></span>
                <span>${e(kindLabel)}</span>
              </span>
              <span class="badge-knowledge-family">
                ${icon('machine')}
                <span>${e(k.family)}</span>
              </span>
              <span class="badge-knowledge-version">v${e(k.version)}</span>
            </div>
            <div class="library-card-status">
              <span class="badge-knowledge-status">
                ${icon('checkcircle')}
                <span>Đã kiểm duyệt</span>
              </span>
            </div>
          </div>

          <div class="library-card-main">
            <h3 class="library-card-title">${e(k.title)}</h3>
          </div>

          <div class="library-card-snippet">
            <div class="snippet-label">DẤU HIỆU / BỐI CẢNH</div>
            <p class="snippet-text">${e(excerpt)}</p>
          </div>

          ${k.tags && k.tags.length ? `
            <div class="library-card-tags">
              ${k.tags.map(t => `<span class="library-tag-chip">#${e(t)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="library-card-meta">
            <div class="meta-item">
              ${icon('user')}
              <span>Tác giả: <strong>${e(S.person(k.authorId))}</strong></span>
            </div>
            <div class="meta-item">
              ${icon('clock')}
              <span>Duyệt: <strong>${e(S.fmtDate(k.updatedAt, false))}</strong></span>
            </div>
            ${assetTag ? `
              <div class="meta-item asset-tag">
                ${icon('machine')}
                <span>Máy: <strong>${e(assetTag)}</strong></span>
              </div>
            ` : ''}
          </div>

          <div class="library-card-footer">
            <button type="button" class="btn btn-secondary library-action-btn" data-action="k-open" data-id="${e(k.id)}">
              <span>Đọc tri thức</span>
              ${icon('arrow')}
            </button>
            <span class="library-footer-note">
              ${icon('shield')}
              <span>Đã kiểm duyệt</span>
            </span>
          </div>

        </div>
      </article>
    `;
  }

  S.caseCard=caseCard;
  S.visual={dashboard,workRow,proposalRow,header,assetPanel,libraryCard:renderLibraryCard};
})();
