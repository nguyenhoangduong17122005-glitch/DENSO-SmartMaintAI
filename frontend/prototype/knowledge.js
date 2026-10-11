(function () {
  'use strict';
  const S = window.SM;
  const e = S.escape;
  const clone = value => JSON.parse(JSON.stringify(value));
  const statuses = { draft: ['Nháp', 'neutral'], pending: ['Chờ kiểm duyệt', 'amber'], changes: ['Cần bổ sung', 'amber'], rejected: ['Đã từ chối', 'red'], published: ['Đã duyệt · Có thể tra cứu', 'green'], withdrawn: ['Đã lưu trữ do trùng', 'neutral'] };
  const modes = { new: 'Tri thức mới', update: 'Bổ sung phiên bản đã có', link: 'Liên kết case với tri thức đã có' };
  const fields = [
    ['symptom', 'Dấu hiệu / vấn đề', 'Hiện tượng quan sát được, Alarm, bộ phận và tần suất.'],
    ['context', 'Điều kiện phát sinh', 'Chế độ máy, model sản phẩm, line, tốc độ, ca và môi trường liên quan.'],
    ['checks', 'Kiểm tra và căn cứ lựa chọn', 'Đã kiểm tra gì, thấy gì, vì sao ưu tiên hoặc đổi hướng kiểm tra?'],
    ['solution', 'Cách xử lý / bài học', 'Việc đã thực hiện và trình tự; giữ cả hướng thử chưa hiệu quả nếu có.'],
    ['result', 'Kết quả và cách kiểm chứng', 'Kết quả quan sát, tiêu chí kiểm chứng, phần chưa đạt hoặc còn chờ.'],
    ['cause', 'Nguyên nhân / giả thuyết', 'Phân biệt điều đã xác nhận với nhận định chưa được kiểm chứng.'],
    ['evidence', 'Bằng chứng và nguồn', 'Mã hồ sơ, ghi nhận, kết quả đo hoặc tài liệu làm căn cứ.'],
    ['safety', 'An toàn và quy trình tham chiếu', 'Nêu mã/phiên bản quy trình phù hợp cần xác minh trước thao tác.'],
    ['limits', 'Điều kiện áp dụng và giới hạn', 'Áp dụng khi nào, khác biệt nào cần đánh giá, khi nào cần chuyên gia?']
  ];
  const fiveM = ['Con người', 'Máy', 'Vật liệu / sản phẩm', 'Phương pháp', 'Đo lường / kiểm tra', 'Môi trường'];
  const familyOptions = ['Vision', 'CNC', 'Máy ép'];
  const labelMap = { 'tiêu đề': 'title', 'loại máy': 'family', 'dấu hiệu': 'symptom', 'điều kiện': 'context', 'kiểm tra': 'checks', 'xử lý': 'solution', 'kết quả': 'result', 'nguyên nhân': 'cause', 'bằng chứng': 'evidence', 'an toàn': 'safety', 'giới hạn': 'limits' };
  const sample = 'Tiêu đề: Vision — giữ nguyên điều kiện khi so sánh ảnh NG\nLoại máy: Vision\nDấu hiệu: Camera không nhận sản phẩm; NG tăng ở model sản phẩm P-A (dữ liệu demo).\nĐiều kiện: Máy VIS-01, line L1; so sánh cùng model sản phẩm, chế độ và ánh sáng. Chưa kiểm tra ảnh hưởng của tốc độ.\nKiểm tra: Đối chiếu ảnh và điều kiện trước / sau khi thay model; ghi riêng chất lượng ảnh và tín hiệu nhận sản phẩm. Chọn kiểm tra này để phân biệt thay đổi sản phẩm với thay đổi cấu hình máy.\nXử lý: Lưu ảnh và thông số hiện trạng; đối chiếu hướng xử lý đã duyệt với người có thẩm quyền. Không suy ra cần thay camera chỉ từ hiện tượng NG.\nKết quả: Bài học kinh nghiệm, chưa có lần kiểm chứng mới; không ghi nhận máy đã phục hồi.\nNguyên nhân: Chưa xác định; cần kiểm chứng từng giả thuyết theo điều kiện thực tế.\nBằng chứng: Tình huống mô phỏng, không phải biên bản sửa chữa thực tế của DENSO.\nAn toàn: Xác minh SOP-VIS-01 và phiên bản đang có hiệu lực trước thao tác. Mã quy trình này chỉ dùng trong demo.\nGiới hạn: Chỉ tham khảo cho Vision với điều kiện phù hợp; thay model hoặc điều kiện ánh sáng cần đối chiếu lại. Chưa đủ bằng chứng để suy rộng sang mọi máy.';
  let libraryFilter = { query: '', family: 'all', kind: 'all' };
  let proposalFilter = 'all';
  let reviewFilter = 'pending';

  function current() { return S.db.proposals.find(p => p.id === S.ui.id); }
  function status(p) { const x = statuses[p.status] || statuses.draft; return S.badge(x[0], x[1]); }
  function editable(p) { return p && p.authorId === S.user().id && ['draft', 'changes'].includes(p.status); }
  function contributorIds(p) { return (p.contributors || []).map(x => typeof x === 'string' ? x : x.id || x.userId).filter(Boolean); }
  function independent(p) { return p.authorId !== S.user().id && !contributorIds(p).includes(S.user().id); }
  function accessible(p) { return p && (S.user().role === 'lead' || p.authorId === S.user().id || contributorIds(p).includes(S.user().id)); }
  function proposalVersion(p) { return Number(p.version || 1); }
  function addHistory(p, type, detail, snapshot) {
    p.history = p.history || [];
    p.history.push({ id: S.uid('PH'), type, detail, actorId: S.user().id, at: S.now(), version: p.version, ...(snapshot ? { snapshot: clone(snapshot) } : {}) });
  }
  function stamp(p, reason) {
    p.editRevision = Number(p.editRevision || 0) + 1;
    if (p.comparison) p.comparison.stale = true;
    p.updatedAt = S.now();
    p.authorConfirmed = false;
    p.updateCompleteConfirmed = false;
    if (reason) addHistory(p, 'edit', reason);
  }
  function inputAttrs(p, key) { return 'data-input="k-edit" data-id="' + e(p.id) + '" data-key="' + e(key) + '"'; }
  function area(label, key, value, p, hint, rows) { return S.area(label, key, value || '', { hint, rows: rows || 3, attrs: inputAttrs(p, key) }); }
  function field(label, key, value, p, hint) { return S.field(label, key, value || '', { hint, attrs: inputAttrs(p, key) }); }
  function select(label, key, value, options, p, hint) {
    return '<label class="field"><span class="field-label">' + e(label) + '</span><select class="select" name="' + e(key) + '" ' + inputAttrs(p, key) + '>' + options.map(o => '<option value="' + e(o[0]) + '"' + (value === o[0] ? ' selected' : '') + '>' + e(o[1]) + '</option>').join('') + '</select>' + (hint ? '<span class="field-hint">' + e(hint) + '</span>' : '') + '</label>';
  }
  function btn(text, action, style, attrs) { return S.button(text, action, style || 'secondary', attrs || ''); }
  function sourceButton(id, version, label) { return btn(label || 'Đọc nguồn', 'k-source', 'ghost', 'data-id="' + e(id) + '" data-version="' + e(version || '') + '"'); }
  function pageHead(eyebrow, title, description, action) {
    return '<div class="page-head"><div><div class="eyebrow">' + e(eyebrow) + '</div><h1 id="page-title" tabindex="-1">' + e(title) + '</h1><p class="subtext">' + e(description) + '</p></div><div class="actions">' + (action || '') + '</div></div>';
  }
  function preserved(text) { return '<div style="white-space:pre-wrap;overflow-wrap:anywhere">' + e(text || 'Chưa có thông tin') + '</div>'; }
  function contentView(content) {
    return '<div class="stack">' + fields.map(([key, label]) => '<section><h3 class="section-title">' + e(label) + '</h3>' + preserved((content || {})[key]) + '</section>').join('') + '</div>';
  }
  function timeline(p) {
    return '<div class="timeline">' + (p.history || []).slice().reverse().map(h => '<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>' + e(h.detail || h.type) + '</strong><div class="source-meta">' + e(S.person(h.actorId)) + ' · ' + e(S.fmtDate(h.at)) + ' · bản đề xuất ' + e(h.version || 1) + '</div></div></div>').join('') + '</div>';
  }
  function parseRaw(raw) {
    const result = { content: {} };
    let activeKey = null;
    for (const line of String(raw || '').split(/\r?\n/)) {
      const i = line.indexOf(':');
      const key = i >= 0 ? labelMap[line.slice(0, i).trim().toLocaleLowerCase('vi')] : null;
      if (key) { activeKey = key; if (key === 'title' || key === 'family') result[key] = line.slice(i + 1).trim(); else result.content[key] = line.slice(i + 1).trim(); }
      else if (activeKey && line.trim()) { if (activeKey === 'title' || activeKey === 'family') result[activeKey] += '\n' + line; else result.content[activeKey] += '\n' + line; }
    }
    return result;
  }
  function baseProposal(authorId, origin) {
    return { id: S.uid('DP'), title: '', authorId, contributors: [], origin: origin || 'expert', caseId: null, status: 'draft', content: {}, family: '', mode: 'new', targetId: '', targetVersion: null, feedback: '', version: 1, rawText: '', rationale: '', response: '', causeStatus: 'unknown', authorConfirmed: false, comparison: null, contextDetails: {}, changes5m: {}, history: [], createdAt: S.now(), updatedAt: S.now() };
  }
  function issues(p) {
    const out = [];
    if (!p.title.trim()) out.push('Tiêu đề');
    if (!p.family) out.push('Loại máy');
    for (const [key, label] of fields) if (!String((p.content || {})[key] || '').trim()) out.push(label + ' (hoặc ghi lý do chưa rõ / không áp dụng)');
    if (p.causeStatus === 'confirmed' && !(p.content.evidence || '').trim()) out.push('Bằng chứng xác nhận nguyên nhân');
    return out;
  }
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/\s+/g, ' ').trim(); }
  function tokens(value) { return new Set(normalize(value).split(/[^a-z0-9]+/).filter(x => x.length > 2)); }
  function candidates(p) {
    const pt = tokens([p.title, ...Object.values(p.content || {})].join(' '));
    return S.db.knowledge.filter(k => k.status === 'published').map(k => {
      const kt = tokens([k.title, ...Object.values(k.content || {})].join(' '));
      let shared = 0; pt.forEach(t => { if (kt.has(t)) shared++; });
      return { k, rank: (k.id === p.targetId ? 1000 : 0) + (normalize(k.family) === normalize(p.family) ? 100 : 0) + shared };
    }).filter(x => normalize(x.k.family) === normalize(p.family) || x.rank > 6).sort((a, b) => b.rank - a.rank).slice(0, 3).map(x => ({ id: x.k.id, version: x.k.version }));
  }
  function hasCurrentComparison(p) { return p.comparison && !p.comparison.stale && p.comparison.version === p.version && p.comparison.sources.every(s => { const k = S.db.knowledge.find(k => k.id === s.id); return k && k.status === 'published' && k.version === s.version; }); }
  function caseSourceCurrent(p) {
    if (p.origin !== 'case') return true;
    const c = S.db.cases.find(x => x.id === p.caseId);
    return !!(c && c.reportState === 'confirmed' && p.reportSnapshot && c.report?.id === p.reportSnapshot.id && c.report?.revision === p.reportSnapshot.revision && c.report?.confirmedAt === p.reportSnapshot.confirmedAt);
  }
  function compareView(p) {
    if (!p.comparison) return S.empty('Đối chiếu trước khi gửi', 'Hoàn thiện và xác nhận biểu mẫu, sau đó đối chiếu với các nguồn đã duyệt.', btn('Đối chiếu kho tri thức', 'k-compare', 'primary', 'data-id="' + e(p.id) + '"'));
    return '<div class="notice notice-info">Đối chiếu mô phỏng dựa trên loại máy và từ khóa. “Khác cách ghi” không chứng minh khác về chuyên môn; hãy đọc nguồn trước khi chọn hướng gửi.</div>' + (!hasCurrentComparison(p) ? '<div class="notice notice-warning" role="status">Bản nháp hoặc nguồn đã thay đổi. Cần kiểm tra nội dung và đối chiếu lại trước khi gửi.</div>' : '') +
      (p.comparison.sources.length ? p.comparison.sources.map(s => {
        const k = S.getKnowledge(s.id, s.version);
        if (!k) return '<div class="notice notice-warning">Nguồn ' + e(s.id) + ' không còn khả dụng. Hãy đối chiếu lại.</div>';
        return '<article class="card"><div class="card-head"><div><div class="source-meta">' + e(k.id) + ' · v' + e(k.version) + ' · ' + e(k.family) + '</div><h3>' + e(k.title) + '</h3><div class="source-meta">Tác giả: ' + e(S.person(k.authorId)) + ' · Duyệt: ' + e(S.person(k.reviewerId)) + '</div></div>' + sourceButton(k.id, k.version, 'Đọc toàn văn') + '</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tiêu chí</th><th>Đề xuất của bạn</th><th>Nguồn đã duyệt</th><th>Đối chiếu</th></tr></thead><tbody>' + fields.map(([key, label]) => {
          const a = (p.content || {})[key], b = (k.content || {})[key];
          const unresolved = value => !value || /^(chua (xac dinh|biet|ro|co thong tin|du du kien)|khong co du lieu)/.test(normalize(value));
          const kind = unresolved(a) || unresolved(b) ? ['Chưa đủ dữ liệu', 'amber'] : normalize(a) === normalize(b) ? ['Cùng nội dung ghi', 'green'] : ['Khác cách ghi · cần đọc', 'blue'];
          const excerpt = value => value && value.length > 180 ? value.slice(0, 177) + '…' : value;
          return '<tr><th scope="row">' + e(label) + '</th><td>' + preserved(excerpt(a)) + '</td><td>' + preserved(excerpt(b)) + '</td><td>' + S.badge(kind[0], kind[1]) + '</td></tr>';
        }).join('') + '</tbody></table></div></article>';
      }).join('') : '<div class="notice notice-warning">Chưa tìm thấy nguồn phù hợp trong dữ liệu demo. Kết quả này không chứng minh nội dung hoàn toàn mới.</div>');
  }
  function metaCard(p) {
    return '<div class="card"><div class="card-body stack"><h3 class="section-title">Dấu vết đóng góp</h3><dl class="kv-list"><dt>Mã đề xuất</dt><dd class="mono">' + e(p.id) + '</dd><dt>Tác giả</dt><dd>' + e(S.person(p.authorId)) + '</dd><dt>Nguồn</dt><dd>' + (p.origin === 'case' ? 'Báo cáo công việc ' + e(p.caseId) : 'Kinh nghiệm chuyên gia') + '</dd><dt>Bản đang xem</dt><dd>' + e(proposalVersion(p)) + '</dd><dt>Cập nhật</dt><dd>' + e(S.fmtDate(p.updatedAt)) + '</dd><dt>Người cùng đóng góp</dt><dd>' + e(contributorIds(p).map(S.person).join(', ') || 'Chưa có người khác') + '</dd></dl>' + (p.caseId ? btn('Xem báo cáo nguồn', 'k-case-source', 'secondary', 'data-id="' + e(p.id) + '"') : '') + '</div></div><div class="card"><div class="card-body stack"><h3 class="section-title">Lịch sử đề xuất</h3>' + timeline(p) + ((p.submissions || []).length ? '<h3 class="section-title">Các bản đã gửi</h3>' + p.submissions.slice().reverse().map(sub => btn('Bản ' + sub.version + ' · ' + S.fmtDate(sub.at, false), 'k-submission', 'secondary', 'data-id="' + e(p.id) + '" data-submission="' + e(sub.id) + '"')).join('') : '') + '</div></div>';
  }

  S.seed(function (db) {
    if (db.seededProposals) return;
    db.proposals = db.proposals || [];
    const source = parseRaw(sample);
    const p = baseProposal('u-hai', 'expert');
    Object.assign(p, { id: 'DP-026', title: source.title, family: 'Vision', rawText: sample, content: clone(source.content), status: 'pending', version: 3, mode: 'new', rationale: 'Bổ sung cách ghi điều kiện so sánh và giới hạn kết luận khi thay model sản phẩm.', authorConfirmed: true, createdAt: '2026-10-08T02:15:00+07:00', updatedAt: '2026-10-09T08:20:00+07:00', comparison: { version: 3, at: '2026-10-09T08:18:00+07:00', sources: db.knowledge.filter(k => k.family === 'Vision' && k.status === 'published').slice(0, 2).map(k => ({ id: k.id, version: k.version })) }, history: [{ id: 'PHS-1', type: 'submit', actorId: 'u-hai', at: '2026-10-09T08:20:00+07:00', version: 3, detail: 'Gửi tri thức mới để kiểm duyệt' }] });
    const p2 = baseProposal('u-hai', 'expert');
    Object.assign(p2, { id: 'DP-027', title: 'CNC — ghi nhận nhiệt độ trước khi kết luận nguyên nhân', family: 'CNC', rawText: 'Ghi chú demo: Khi nhiệt độ tăng, cần ghi lại điều kiện tải và thời điểm quan sát trước khi suy ra nguyên nhân.', content: { symptom: 'Nhiệt độ cụm trục tăng trong một giai đoạn làm việc (demo).', context: 'Máy CNC-04; chưa xác minh tải, tốc độ và thời gian kể từ khởi động.', checks: 'Đối chiếu số đo với trạng thái tải và điều kiện đo.', solution: 'Ghi đủ điều kiện trước khi trao đổi hướng kiểm tra với chuyên gia.', result: 'Chưa đủ dữ kiện để kết luận hoặc áp dụng hướng xử lý.', cause: 'Chưa xác định.', evidence: 'Ghi chú mô phỏng; chưa có số đo thực tế.', safety: 'Cần xác minh SOP CNC đang có hiệu lực. Không có hướng dẫn thao tác thực tế trong demo.', limits: 'Thiếu dữ liệu tải, thời gian và ngưỡng được phê duyệt; chưa dùng để quyết định sửa chữa.' }, status: 'changes', version: 2, feedback: 'Bổ sung điều kiện tải, nguồn ngưỡng đánh giá và nêu rõ giới hạn khi chưa có số đo. Không kết luận nguyên nhân chỉ từ nhiệt độ.', reviewerId: 'u-anh', createdAt: '2026-10-08T10:00:00+07:00', updatedAt: '2026-10-09T07:30:00+07:00', history: [{ id: 'PHS-2', type: 'changes', actorId: 'u-anh', at: '2026-10-09T07:30:00+07:00', version: 2, detail: 'Yêu cầu bổ sung điều kiện và bằng chứng' }] });
    const p3 = baseProposal('u-hai', 'expert');
    Object.assign(p3, { id: 'DP-028', title: 'Ghi chú buổi trao đổi về Vision', family: 'Vision', rawText: sample, createdAt: '2026-10-09T09:00:00+07:00', updatedAt: '2026-10-09T09:00:00+07:00', history: [{ id: 'PHS-3', type: 'draft', actorId: 'u-hai', at: '2026-10-09T09:00:00+07:00', version: 1, detail: 'Lưu nội dung gốc; chưa gửi kiểm duyệt' }] });
    db.proposals.push(p, p2, p3);
    db.seededProposals = true;
  });

  S.pages.library = { title: 'Kho tri thức', roles: ['maintenance', 'expert', 'lead'], render: function () {
    const q = normalize(libraryFilter.query);
    const items = S.db.knowledge.filter(k => k.status === 'published' && (libraryFilter.family === 'all' || k.family === libraryFilter.family) && (libraryFilter.kind === 'all' || k.kind === libraryFilter.kind) && (!q || normalize([k.id, k.title, k.family, ...Object.values(k.content || {})].join(' ')).includes(q)));
    return pageHead('KNOWLEDGE BASE', 'Kho tri thức đã duyệt', 'Tra cứu kinh nghiệm và case đã được kiểm duyệt, có tác giả, nguồn và phiên bản.', S.user().role === 'expert' ? btn('Ghi tri thức mới', 'k-new', 'primary') : '') +
      '<form data-form="k-search" class="card"><div class="card-body form-grid">' + S.field('Tìm trong kho tri thức', 'query', libraryFilter.query, { placeholder: 'Mã nguồn, hiện tượng hoặc từ khóa…' }) + '<label class="field"><span class="field-label">Loại máy</span><select class="select" name="family"><option value="all">Tất cả loại máy</option>' + familyOptions.map(f => '<option' + (libraryFilter.family === f ? ' selected' : '') + '>' + e(f) + '</option>').join('') + '</select></label><label class="field"><span class="field-label">Nguồn đóng góp</span><select class="select" name="kind">' + [['all', 'Tất cả nguồn'], ['expert', 'Tri thức chuyên gia'], ['case', 'Case công việc']].map(([v, t]) => '<option value="' + v + '"' + (libraryFilter.kind === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label><div class="actions"><button class="btn btn-primary" type="submit">Tìm kiếm</button>' + btn('Xóa bộ lọc', 'k-reset-search', 'ghost') + '</div></div></form>' +
      '<div class="section-title">' + items.length + ' nguồn sẵn sàng tra cứu</div><div class="grid-2">' + items.map(k => '<article class="card source-card"><div class="card-body stack"><div class="actions">' + S.badge(k.kind === 'case' ? 'Case đã duyệt' : 'Kinh nghiệm chuyên gia', k.kind === 'case' ? 'purple' : 'blue') + S.badge(k.family) + '</div><div><div class="source-meta">' + e(k.id) + ' · Phiên bản ' + e(k.version) + '</div><h2>' + e(k.title) + '</h2></div><p>' + e((k.content.symptom || '').slice(0, 230)) + '</p><div class="source-meta">Tác giả: ' + e(S.person(k.authorId)) + '<br>Người duyệt: ' + e(S.person(k.reviewerId)) + ' · ' + e(S.fmtDate(k.updatedAt, false)) + '</div>' + btn('Mở tri thức', 'k-open', 'secondary', 'data-id="' + e(k.id) + '"') + '</div></article>').join('') + '</div>' + (!items.length ? S.empty('Chưa có nguồn phù hợp', 'Thử loại máy hoặc từ khóa khác. Bản nháp và đề xuất chưa duyệt không xuất hiện ở đây.') : '');
  } };
  S.pages['knowledge-detail'] = { title: 'Chi tiết tri thức', roles: ['maintenance', 'expert', 'lead'], render: function () {
    const currentK = S.db.knowledge.find(k => k.id === S.ui.id && k.status === 'published');
    const version = S.ui.tab && /^v\d+$/.test(S.ui.tab) ? Number(S.ui.tab.slice(1)) : undefined;
    const k = currentK && S.getKnowledge(currentK.id, version);
    if (!k) return S.empty('Không tìm thấy tri thức', 'Nguồn hoặc phiên bản này không có trong kho đã duyệt.', btn('Về kho tri thức', 'k-library'));
    const snapshots = (currentK.history || []).map(h => h.snapshot || h).filter(h => h && h.version);
    const versions = [...new Set([currentK.version, ...snapshots.map(h => h.version)])].sort((a, b) => b - a);
    return pageHead(k.id + ' / v' + k.version, k.title, 'Tác giả ' + S.person(k.authorId) + ' · Người duyệt ' + S.person(k.reviewerId), btn('Về kho tri thức', 'k-library') + (S.user().role === 'expert' ? btn('Đề xuất bổ sung', 'k-update-source', 'primary', 'data-id="' + e(currentK.id) + '"') : '')) +
      (k.version !== currentK.version ? '<div class="notice notice-warning">Bạn đang xem phiên bản lịch sử. Phiên bản hiện hành là v' + e(currentK.version) + '. Các hồ sơ đã tham khảo bản cũ vẫn giữ nguồn tương ứng.</div>' : '<div class="notice notice-success">Phiên bản đã duyệt · Sẵn sàng tham khảo trong phạm vi điều kiện và giới hạn của nguồn.</div>') +
      '<div class="split-layout"><div class="card"><div class="card-body">' + contentView(k.content) + '</div></div><aside class="stack"><div class="card"><div class="card-body stack"><h3 class="section-title">Thông tin nguồn</h3><dl class="kv-list"><dt>Loại máy</dt><dd>' + e(k.family) + '</dd><dt>Nguồn</dt><dd>' + (k.kind === 'case' ? 'Case công việc đã duyệt' : 'Kinh nghiệm chuyên gia') + '</dd><dt>Đóng góp</dt><dd>' + e(contributorIds(k).map(S.person).join(', ') || S.person(k.authorId)) + '</dd><dt>Ngày xuất bản</dt><dd>' + e(S.fmtDate(k.updatedAt)) + '</dd><dt>Nguyên nhân</dt><dd>' + e(({ confirmed: 'Đã xác nhận theo bằng chứng nguồn', hypothesis: 'Giả thuyết', unknown: 'Chưa xác định' })[k.causeStatus] || 'Xem căn cứ trong nội dung') + '</dd></dl></div></div><div class="card"><div class="card-body stack"><h3 class="section-title">Phiên bản</h3>' + versions.map(v => btn('v' + v + (v === currentK.version ? ' · hiện hành' : ' · lịch sử'), 'k-version', v === k.version ? 'primary' : 'secondary', 'data-id="' + e(k.id) + '" data-version="' + v + '"')).join('') + '</div></div><div class="notice notice-info">Dữ liệu minh họa. Việc áp dụng cần đối chiếu điều kiện thực tế và quy trình có hiệu lực tại nhà máy.</div></aside></div>';
  } };

  S.pages.proposals = { title: 'Đề xuất của tôi', roles: ['expert', 'maintenance'], render: function () {
    const items = S.db.proposals.filter(p => p.authorId === S.user().id && (proposalFilter === 'all' || p.status === proposalFilter)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return pageHead('ĐÓNG GÓP TRI THỨC', 'Đề xuất của tôi', S.user().role === 'expert' ? 'Ghi lại kinh nghiệm, đối chiếu với kho và theo dõi phản hồi kiểm duyệt.' : 'Tri thức được đề xuất từ báo cáo công việc đã xác nhận. Lịch sử công việc luôn được giữ riêng.', S.user().role === 'expert' ? btn('Ghi tri thức mới', 'k-new', 'primary') : '') +
      '<div class="tabs" aria-label="Lọc trạng thái đề xuất">' + [['all', 'Tất cả'], ['draft', 'Nháp'], ['pending', 'Chờ duyệt'], ['changes', 'Cần bổ sung'], ['published', 'Đã duyệt'], ['rejected', 'Từ chối'], ['withdrawn', 'Đã lưu trữ']].map(([v, t]) => '<button type="button" class="tab' + (proposalFilter === v ? ' active' : '') + '" data-action="k-proposal-filter" data-value="' + v + '">' + t + '</button>').join('') + '</div>' +
      (items.length ? '<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Đề xuất</th><th>Nguồn / loại</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>' + items.map(p => '<tr><td><strong>' + e(p.title || 'Tri thức chưa đặt tên') + '</strong><div class="source-meta">' + e(p.id) + ' · bản ' + e(p.version) + ' · ' + e(p.family || 'Chưa chọn máy') + '</div></td><td>' + e(p.origin === 'case' ? 'Case ' + p.caseId : 'Chuyên gia') + '<div class="source-meta">' + e(modes[p.mode]) + '</div></td><td>' + status(p) + '</td><td>' + e(S.fmtDate(p.updatedAt)) + '</td><td>' + btn(editable(p) ? 'Tiếp tục soạn' : 'Xem đề xuất', 'k-open-proposal', 'secondary', 'data-id="' + e(p.id) + '"') + '</td></tr>').join('') + '</tbody></table></div></div>' : S.empty('Chưa có đề xuất ở trạng thái này', S.user().role === 'maintenance' ? 'Mở một hồ sơ có báo cáo đã xác nhận để đề xuất case tri thức.' : 'Tạo bản nháp đầu tiên hoặc chọn bộ lọc khác.'));
  } };

  function proposalForm(p) {
    const missing = issues(p);
    return '<div class="card"><div class="card-head"><div><h2>Biểu mẫu tri thức</h2><p class="subtext">Giữ dữ kiện gốc. Mục chưa rõ hoặc không áp dụng cần nêu lý do ngay trong ô.</p></div>' + S.badge(missing.length ? missing.length + ' mục cần hoàn thiện' : 'Đã đủ các mục', missing.length ? 'amber' : 'green') + '</div><div class="card-body stack"><div class="form-grid">' + field('Tiêu đề *', 'title', p.title, p) + select('Loại máy *', 'family', p.family, [['', 'Chọn loại máy'], ...familyOptions.map(f => [f, f])], p) + '</div>' +
      fields.map(([key, label, hint]) => area(label + ' *', 'content.' + key, p.content[key], p, hint)).join('') +
      select('Trạng thái nhận định nguyên nhân', 'causeStatus', p.causeStatus || 'unknown', [['unknown', 'Chưa xác định'], ['hypothesis', 'Giả thuyết cần kiểm chứng'], ['confirmed', 'Đã xác nhận — có bằng chứng']], p, 'Máy hoạt động lại không tự chứng minh nguyên nhân gốc.') +
      '<details><summary>Thông tin điều kiện chi tiết và điểm thay đổi 5M1E</summary><div class="stack"><div class="form-grid">' + [['machineModel', 'Model máy'], ['productModel', 'Model sản phẩm'], ['mode', 'Chế độ vận hành'], ['speed', 'Tốc độ / tải và đơn vị'], ['line', 'Line / khu vực'], ['shift', 'Ca làm việc']].map(([key, label]) => field(label, 'contextDetails.' + key, (p.contextDetails || {})[key], p)).join('') + '</div>' + fiveM.map((label, i) => '<div class="form-grid">' + select(label, 'changes5m.m' + i, (p.changes5m || {})['m' + i] || 'unchecked', [['unchecked', 'Chưa kiểm tra'], ['none', 'Chưa ghi nhận thay đổi'], ['changed', 'Có thay đổi']], p) + field('Chi tiết ' + label.toLowerCase(), 'changes5m.d' + i, (p.changes5m || {})['d' + i], p, 'Ghi mốc và nội dung nếu có thay đổi trước khi xuất hiện vấn đề.') + '</div>').join('') + '</div></details>' +
      '<label class="check-line"><input type="checkbox" data-input="k-author-check" data-id="' + e(p.id) + '"' + (p.authorConfirmed ? ' checked' : '') + '> Tôi đã đọc, kiểm tra cách phân loại và xác nhận nội dung cùng các giới hạn của bản này.</label><div class="error-summary" data-k-error tabindex="-1" hidden></div><div class="actions">' + btn('Đối chiếu kho tri thức', 'k-compare', 'primary', 'data-id="' + e(p.id) + '"') + '</div></div></div>';
  }
  function rawEditor(p) {
    return '<div class="card"><div class="card-head"><div><h2>Ghi lại kinh nghiệm</h2><p class="subtext">Gõ hoặc dán ghi chú, nội dung trao đổi hay biên bản vào cùng một ô.</p></div></div><div class="card-body stack">' + area('Nội dung gốc', 'rawText', p.rawText, p, 'Không có nhập file hay ghi âm trong phiên bản này. Nội dung gốc được giữ khi chuyển sang biểu mẫu.', 13) +
      '<div class="notice notice-info"><strong>AI mô phỏng có giới hạn.</strong> Bản demo chuyển các dòng có nhãn “Dấu hiệu:”, “Điều kiện:”, “Kiểm tra:”… vào đúng mục; phần thiếu để trống. Văn bản tự do không có nhãn được giữ để bạn tự hoàn thiện.</div><div class="actions">' + btn('AI sắp xếp nội dung', 'k-structure', 'primary', 'data-id="' + e(p.id) + '"') + btn('Dùng ghi chú mẫu', 'k-sample', 'secondary', 'data-id="' + e(p.id) + '"') + btn('Điền biểu mẫu', 'k-tab', 'ghost', 'data-tab="form"') + '</div><p class="field-hint">Nếu có nhiều chủ đề, ngăn cách bằng một dòng --- để xem và tách thành các bản nháp riêng.</p></div></div>';
  }
  function decisionForm(p) {
    const sourceOptions = (p.comparison ? p.comparison.sources : []).map(s => { const k = S.getKnowledge(s.id, s.version); return k ? [k.id, k.id + ' · v' + k.version + ' — ' + k.title] : null; }).filter(Boolean);
    return '<div class="card"><div class="card-body stack"><h2>Chọn hướng ghi nhận</h2>' + select('Loại đề xuất', 'mode', p.mode || 'new', [['new', 'Tạo tri thức mới'], ['update', 'Bổ sung tri thức đã có'], ...(p.origin === 'case' ? [['link', 'Chỉ liên kết case lặp lại']] : [])], p) +
      select('Nguồn đối chiếu / phiên bản gốc', 'targetId', p.targetId || '', [['', 'Chọn nếu cập nhật, liên kết hoặc hủy do trùng'], ...sourceOptions], p) +
      area('Điểm mới, khác biệt hoặc lý do liên kết *', 'rationale', p.rationale, p, 'Ghi rõ điều kiện khác, nội dung bổ sung và lý do; việc cập nhật giữ nguyên phiên bản cũ.') +
      '<label class="check-line"><input type="checkbox" data-input="k-update-complete" data-id="' + e(p.id) + '"' + (p.updateCompleteConfirmed ? ' checked' : '') + '> Nếu chọn bổ sung: tôi đã rà toàn bộ bản kế tiếp, giữ phần tri thức gốc còn đúng và chỉ thay đổi phần có căn cứ. Phiên bản cũ được lưu trong lịch sử.</label>' +
      (p.status === 'changes' ? area('Phản hồi của bạn với người duyệt *', 'response', p.response, p, 'Nêu đã bổ sung gì và phần nào còn chưa đủ căn cứ.') : '') +
      '<div class="notice notice-info" data-k-comparison-status>' + (hasCurrentComparison(p) ? 'Đối chiếu đang gắn với bản hiện tại.' : 'Cần đối chiếu lại bản hiện tại trước khi gửi.') + '</div><div class="error-summary" data-k-error tabindex="-1" hidden></div><div class="actions">' + btn('Xem lại và gửi kiểm duyệt', 'k-submit-preview', 'primary', 'data-id="' + e(p.id) + '"') + btn('Đối chiếu lại', 'k-compare', 'secondary', 'data-id="' + e(p.id) + '"') + btn('Lưu trữ đề xuất trùng', 'k-withdraw', 'ghost', 'data-id="' + e(p.id) + '"') + '</div></div></div>';
  }
  S.pages.proposal = { title: 'Soạn đề xuất', roles: ['expert', 'maintenance'], render: function () {
    const p = current();
    if (!accessible(p)) return S.empty('Không thể mở đề xuất', 'Bạn chỉ có quyền mở đề xuất của mình hoặc đề xuất có đóng góp của mình.', btn('Về đề xuất của tôi', 'k-proposals'));
    const canEdit = editable(p);
    const tab = ['raw', 'form', 'compare'].includes(S.ui.tab) ? S.ui.tab : 'form';
    return pageHead(p.id + ' / BẢN ' + p.version, p.title || 'Tri thức mới', 'Tác giả: ' + S.person(p.authorId) + ' · ' + (p.origin === 'case' ? 'Trích từ báo cáo đã xác nhận của ' + p.caseId : 'Ghi nhận kinh nghiệm chuyên gia'), status(p) + btn(canEdit ? 'Lưu và thoát' : 'Về danh sách', 'k-proposals')) +
      (p.origin === 'case' && !caseSourceCurrent(p) && !['published','withdrawn','rejected'].includes(p.status) ? '<div class="notice notice-warning"><strong>Báo cáo nguồn đã thay đổi hoặc đang được đính chính.</strong><p>Nội dung đề xuất vẫn giữ bản nguồn lúc tạo. Cần đối chiếu với báo cáo đã xác nhận mới trước khi gửi/duyệt.</p>' + (canEdit ? btn('Đối chiếu lại báo cáo nguồn', 'k-refresh-report-preview', 'secondary', 'data-id="' + e(p.id) + '"') : '') + '</div>' : '') +
      (p.feedback ? '<div class="notice ' + (p.status === 'rejected' ? 'notice-danger' : 'notice-warning') + '"><strong>Phản hồi kiểm duyệt</strong>' + preserved(p.feedback) + (p.suggestion ? '<p><strong>Đề nghị sửa ' + e(fields.find(f => f[0] === p.suggestion.field)?.[1] || p.suggestion.field) + ':</strong></p>' + preserved(p.suggestion.text) + (canEdit ? btn('Áp dụng nội dung đề nghị', 'k-accept-suggestion', 'secondary', 'data-id="' + e(p.id) + '"') : '') : '') + '</div>' : '') +
      (p.publishedId ? '<div class="notice notice-success">' + (p.mode === 'link' ? 'Đã duyệt liên kết với ' : 'Đã xuất bản ') + e(p.publishedId) + ' · v' + e(p.publishedVersion) + ' ' + sourceButton(p.publishedId, p.publishedVersion, 'Mở tri thức') + '</div>' : '') +
      '<div class="split-layout"><div class="stack">' + (canEdit ? '<div class="status-strip"><span class="save-state" data-save-state>Đã lưu · ' + e(S.fmtDate(p.updatedAt)) + '</span><span data-k-comparison-status>' + (hasCurrentComparison(p) ? 'Đã đối chiếu bản hiện tại' : 'Nội dung cần được đối chiếu trước khi gửi') + '</span></div><div class="tabs" aria-label="Các bước ghi nhận">' + [['raw', '1. Nội dung gốc'], ['form', '2. Kiểm tra biểu mẫu'], ['compare', '3. Đối chiếu & gửi']].map(([v, label]) => '<button type="button" class="tab' + (tab === v ? ' active' : '') + '" data-action="k-tab" data-tab="' + v + '">' + label + '</button>').join('') + '</div>' + (tab === 'raw' ? rawEditor(p) : tab === 'form' ? proposalForm(p) : compareView(p) + decisionForm(p)) :
        '<div class="notice notice-info">' + (p.status === 'pending' ? 'Bản đã gửi được khóa để kiểm duyệt đúng nội dung. Kết quả sẽ có trong thông báo và đề xuất của bạn.' : p.status === 'withdrawn' ? 'Nháp được giữ trong lịch sử; không tạo bản mới trong kho.' : 'Nội dung và lịch sử được giữ để truy vết.') + '</div><div class="card"><div class="card-body">' + contentView(p.content) + '</div></div><details class="card"><summary class="card-head">Nội dung gốc</summary><div class="card-body">' + preserved(p.rawText) + '</div></details>') + '</div><aside class="stack">' + metaCard(p) + '</aside></div>';
  } };

  S.pages.review = { title: 'Kiểm duyệt tri thức', roles: ['lead'], render: function () {
    const items = S.db.proposals.filter(p => reviewFilter === 'all' ? ['pending', 'changes', 'published', 'rejected'].includes(p.status) : p.status === reviewFilter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return pageHead('KIỂM DUYỆT ĐỘC LẬP', 'Hàng đợi tri thức', 'Xem nội dung, nguồn và giới hạn áp dụng trước khi quyết định. Mỗi kết quả đều có phản hồi cho tác giả.') +
      '<div class="tabs">' + [['pending', 'Chờ duyệt'], ['changes', 'Chờ tác giả bổ sung'], ['all', 'Lịch sử quyết định']].map(([v, t]) => '<button type="button" class="tab' + (reviewFilter === v ? ' active' : '') + '" data-action="k-review-filter" data-value="' + v + '">' + t + '</button>').join('') + '</div>' +
      (items.length ? '<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Đề xuất</th><th>Tác giả / nguồn</th><th>Loại đề xuất</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + items.map(p => '<tr><td><strong>' + e(p.title || 'Chưa đặt tên') + '</strong><div class="source-meta">' + e(p.id) + ' · bản ' + e(p.version) + ' · ' + e(p.family) + '</div></td><td>' + e(S.person(p.authorId)) + '<div class="source-meta">' + e(p.origin === 'case' ? p.caseId : 'Kinh nghiệm chuyên gia') + '</div></td><td>' + e(modes[p.mode]) + '</td><td>' + status(p) + (!independent(p) ? '<div class="field-hint">Cần người duyệt độc lập khác</div>' : '') + '</td><td>' + btn('Mở kiểm duyệt', 'k-open-review', 'secondary', 'data-id="' + e(p.id) + '"') + '</td></tr>').join('') + '</tbody></table></div></div>' : S.empty('Không có đề xuất ở nhóm này', 'Đề xuất từ chuyên gia và case đã xác nhận sẽ xuất hiện tại đây sau khi người gửi hoàn tất đối chiếu.'));
  } };
  S.pages['review-detail'] = { title: 'Xem đề xuất kiểm duyệt', roles: ['lead'], render: function () {
    const p = current();
    if (!p) return S.empty('Không tìm thấy đề xuất', 'Đề xuất này không có trong dữ liệu hiện tại.');
    const mayReview = p.status === 'pending' && independent(p);
    return pageHead('KIỂM DUYỆT / ' + p.id, p.title || 'Đề xuất tri thức', 'Tác giả: ' + S.person(p.authorId) + ' · ' + modes[p.mode] + ' · bản ' + p.version, status(p) + btn('Về hàng đợi', 'k-review')) +
      (!independent(p) ? '<div class="notice notice-danger">Bạn là tác giả hoặc người cùng đóng góp, nên không thể duyệt đề xuất này. Cần người duyệt độc lập khác; prototype chưa phân công người duyệt thay thế.</div>' : '') +
      '<div class="split-layout"><main class="stack"><div class="card"><div class="card-body stack"><h2>Nội dung gửi duyệt</h2><div class="notice notice-info"><strong>Căn cứ gửi:</strong> ' + e(p.rationale || 'Chưa ghi') + (p.targetId ? '<br>Nguồn mục tiêu: ' + e(p.targetId) + ' · v' + e(p.targetVersion) : '') + '</div>' + contentView(p.content) + '</div></div><details class="card"><summary class="card-head">Nội dung gốc và phản hồi của tác giả</summary><div class="card-body stack">' + preserved(p.rawText) + '<h3>Phản hồi vòng bổ sung</h3>' + preserved(p.response) + '</div></details><details class="card"><summary class="card-head">Các nguồn được đối chiếu khi gửi</summary><div class="card-body stack">' + compareView(p) + '</div></details>' +
      (mayReview ? '<form data-form="k-decision" data-id="' + e(p.id) + '" data-version="' + p.version + '" class="card"><div class="card-body stack"><h2>Quyết định kiểm duyệt</h2><div class="notice notice-info">Sửa nội dung chuyên môn phải chuyển về tác giả xác nhận. Các ghi nhận và báo cáo công việc gốc luôn được giữ nguyên.</div><label class="field"><span class="field-label">Quyết định *</span><select class="select" name="decision" required><option value="">Chọn quyết định</option><option value="approve">Phê duyệt và xuất bản</option><option value="changes">Yêu cầu bổ sung / xác nhận thay đổi</option><option value="reject">Từ chối đề xuất</option></select></label>' + S.area('Nhận xét và căn cứ quyết định *', 'feedback', '', { rows: 4, required: true, hint: 'Phản hồi này được gửi lại tác giả cho mọi quyết định.' }) +
      '<details><summary>Đề nghị sửa một mục chuyên môn</summary><div class="stack"><label class="field"><span class="field-label">Mục cần sửa</span><select class="select" name="suggestField"><option value="">Không đề nghị bản thay thế</option>' + fields.map(([key, label]) => '<option value="' + key + '">' + e(label) + '</option>').join('') + '</select></label>' + S.area('Nội dung đề nghị', 'suggestText', '', { rows: 4, hint: 'Chọn “Yêu cầu bổ sung”; tác giả phải đọc, chỉnh hoặc chấp nhận và gửi lại.' }) + '</div></details><details><summary>Sửa biên tập tiêu đề</summary><div class="stack">' + S.field('Tiêu đề sau sửa', 'editorialTitle', p.title, { hint: 'Chỉ chính tả/diễn đạt; thay đổi chuyên môn cần trả về tác giả.' }) + S.area('Ghi chú chỉnh biên tập', 'editorialNote', '', { rows: 2 }) + '</div></details><label class="check-line"><input type="checkbox" name="reviewConfirmed" required> Tôi đã xem nguồn, điều kiện áp dụng và nội dung an toàn; quyết định đúng phạm vi chuyên môn được giao.</label><div class="error-summary" hidden tabindex="-1"></div><button type="submit" class="btn btn-primary">Xem lại quyết định</button></div></form>' : '<div class="notice notice-info">' + (p.status === 'changes' ? 'Đề xuất đang chờ tác giả bổ sung. Chỉ duyệt tiếp sau khi tác giả gửi lại.' : 'Đề xuất đã có quyết định hoặc chưa đủ quyền để duyệt.') + (p.feedback ? preserved(p.feedback) : '') + '</div>') + '</main><aside class="stack">' + metaCard(p) + '</aside></div>';
  } };

  function err(text) { const target = document.querySelector('[data-k-error]')?.parentElement || document.querySelector('.page-content') || document.body; S.error(target, text); S.toast(text, 'danger'); }
  function ownership(p) { if (!editable(p)) { S.toast('Bạn không có quyền sửa bản này hoặc bản đã được gửi.', 'error'); return false; } return true; }
  function updateSaveStatus(p, stale) {
    if (stale) {
      document.querySelectorAll('[data-k-comparison-status]').forEach(el => { el.textContent = 'Nội dung đã thay đổi. Hãy xác nhận biểu mẫu và đối chiếu lại.'; });
      document.querySelectorAll('[data-input="k-author-check"]').forEach(el => { el.checked = false; });
      document.querySelectorAll('[data-input="k-update-complete"]').forEach(el => { el.checked = false; });
    }
  }
  S.inputs['k-edit'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id);
    if (!ownership(p)) return;
    const key = el.dataset.key;
    const safeKeys = ['title', 'family', 'rawText', 'mode', 'targetId', 'rationale', 'response', 'causeStatus'];
    if (!safeKeys.includes(key) && !/^(content\.(symptom|context|checks|solution|result|cause|evidence|safety|limits)|contextDetails\.(machineModel|productModel|mode|speed|line|shift)|changes5m\.[md][0-5])$/.test(key)) return;
    const path = key.split('.');
    const previous = path.length === 1 ? p[key] : (p[path[0]] || {})[path[1]];
    if ((previous || '') === el.value) return;
    const isContent = !['mode', 'targetId', 'rationale', 'response'].includes(key);
    const ok = S.commit(() => {
      if (path.length === 1) p[key] = el.value; else { p[path[0]] = p[path[0]] || {}; p[path[0]][path[1]] = el.value; }
      if (key === 'targetId') { const k = S.db.knowledge.find(k => k.id === p.targetId); p.targetVersion = k ? k.version : null; }
      if (['targetId', 'mode'].includes(key)) p.updateCompleteConfirmed = false;
      if (isContent) stamp(p); else p.updatedAt = S.now();
    }, null, false);
    if (ok) { updateSaveStatus(p, isContent); if (['mode','targetId'].includes(key)) document.querySelectorAll('[data-input="k-update-complete"]').forEach(el => { el.checked = false; }); }
  };
  S.inputs['k-author-check'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id);
    if (ownership(p)) S.commit(() => { p.authorConfirmed = el.checked; p.updatedAt = S.now(); }, null, false);
  };
  S.inputs['k-update-complete'] = el => { const p = S.db.proposals.find(x => x.id === el.dataset.id); if (ownership(p) && p.updateCompleteConfirmed !== el.checked) S.commit(() => { p.updateCompleteConfirmed = el.checked; }, null, false); };
  S.forms['k-search'] = function (form) { const fd = new FormData(form); libraryFilter = { query: String(fd.get('query') || ''), family: String(fd.get('family')), kind: String(fd.get('kind')) }; S.render(); };
  S.actions['k-reset-search'] = () => { libraryFilter = { query: '', family: 'all', kind: 'all' }; S.render(); };
  S.actions['k-library'] = () => S.go('library');
  S.actions['k-proposals'] = () => S.go('proposals');
  S.actions['k-review'] = () => S.go('review');
  S.actions['k-open'] = el => S.go('knowledge-detail', el.dataset.id);
  S.actions['k-version'] = el => S.go('knowledge-detail', el.dataset.id, 'v' + el.dataset.version);
  S.actions['k-open-proposal'] = el => S.go('proposal', el.dataset.id);
  S.actions['k-open-review'] = el => S.go('review-detail', el.dataset.id);
  S.actions['k-tab'] = el => S.go('proposal', S.ui.id, el.dataset.tab);
  S.actions['k-proposal-filter'] = el => { proposalFilter = el.dataset.value; S.render(); };
  S.actions['k-review-filter'] = el => { reviewFilter = el.dataset.value; S.render(); };
  S.actions['k-source'] = function (el) {
    const k = S.getKnowledge(el.dataset.id, Number(el.dataset.version) || undefined);
    if (!k || k.status !== 'published') return S.toast('Không tìm thấy nguồn đã duyệt.', 'error');
    S.modal(k.id + ' · v' + k.version + ' — ' + k.title, '<div class="source-meta">' + e(k.family) + ' · Tác giả: ' + e(S.person(k.authorId)) + ' · Duyệt: ' + e(S.person(k.reviewerId)) + '</div><div class="divider"></div>' + contentView(k.content), btn('Đóng nguồn', 'k-close', 'primary'));
  };
  S.actions['k-close'] = () => S.closeModal();
  S.actions['k-refresh-report-preview'] = el => {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    const c = S.db.cases.find(x => x.id === p.caseId);
    if (!c || c.reportState !== 'confirmed') return S.toast('Cần hoàn tất xác nhận bản đính chính báo cáo trước khi cập nhật nguồn cho đề xuất.', 'warning');
    S.modal('Đối chiếu bản báo cáo nguồn', '<div class="stack"><div class="notice notice-info">Biểu mẫu tri thức bạn đã sửa sẽ được giữ. Sau khi đổi bản nguồn, cần rà lại nội dung, xác nhận và đối chiếu kho trước khi gửi.</div><details><summary>Bản nguồn trước · revision ' + e(p.reportSnapshot?.revision) + '</summary>' + preserved(p.reportSnapshot?.summary) + '</details><section><h3>Báo cáo đã xác nhận mới · revision ' + e(c.report.revision) + '</h3>' + preserved(c.report.summary) + '</section></div>', btn('Giữ bản nguồn trước', 'k-close') + btn('Dùng bản nguồn mới và rà lại biểu mẫu', 'k-refresh-report-apply', 'primary', 'data-id="' + e(p.id) + '" data-revision="' + e(c.report.revision) + '"'));
  };
  S.actions['k-refresh-report-apply'] = el => {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    const c = S.db.cases.find(x => x.id === p.caseId);
    if (!c || c.reportState !== 'confirmed' || c.report.revision !== Number(el.dataset.revision)) return S.toast('Báo cáo nguồn đã đổi. Hãy mở đối chiếu lại.', 'warning');
    if (S.commit(() => {
      p.reportSourceHistory ||= []; p.reportSourceHistory.push({ report: clone(p.reportSnapshot), caseSource: clone(p.caseSourceSnapshot || {}), replacedAt: S.now() });
      p.reportSnapshot = clone(c.report); p.reportSourceAt = c.updatedAt;
      p.caseSourceSnapshot = clone({ id:c.id, title:c.title, assetId:c.assetId, ownerId:c.ownerId, machineState:c.machineState, workState:c.workState, context:c.context, resultEvidence:c.resultEvidence, rounds:c.rounds, pm:c.pm || [], participants:c.participants, reportState:c.reportState });
      p.contributors = [...new Set((c.rounds || []).flatMap(r => r.events || []).map(ev => ev.performedBy).filter(id => id && id !== p.authorId))];
      stamp(p, 'Tác giả cập nhật tham chiếu báo cáo revision ' + c.report.revision + '; giữ biểu mẫu để rà lại');
    }, 'Đã đổi bản nguồn. Rà lại toàn bộ biểu mẫu trước khi xác nhận.', false)) { S.closeModal(); S.go('proposal', p.id, 'form'); }
  };
  S.actions['k-new'] = function () {
    if (S.user().role !== 'expert') return S.toast('Người bảo trì tạo đề xuất từ báo cáo đã xác nhận.', 'error');
    const p = baseProposal(S.user().id, 'expert');
    if (S.commit(() => { S.db.proposals.push(p); addHistory(p, 'draft', 'Tạo bản nháp tri thức chuyên gia'); S.log('proposal.create', p.id); }, null, false)) S.go('proposal', p.id, 'raw');
  };
  S.actions['k-update-source'] = function (el) {
    if (S.user().role !== 'expert') return;
    const k = S.db.knowledge.find(x => x.id === el.dataset.id && x.status === 'published');
    if (!k) return;
    const p = baseProposal(S.user().id, 'expert');
    Object.assign(p, { title: k.title, family: k.family, content: clone(k.content), mode: 'update', targetId: k.id, targetVersion: k.version, causeStatus: k.causeStatus || 'unknown', rawText: 'Đề xuất bổ sung dựa trên ' + k.id + ' phiên bản ' + k.version + '. Tác giả nguồn: ' + S.person(k.authorId) + '.', contributors: [] });
    if (S.commit(() => { S.db.proposals.push(p); addHistory(p, 'draft', 'Tạo đề xuất cập nhật ' + k.id + ' v' + k.version); S.log('proposal.update-draft', p.id, k.id); }, null, false)) S.go('proposal', p.id, 'form');
  };
  S.actions['k-sample'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    S.modal('Dùng ghi chú mô phỏng', '<div class="notice notice-info">Mẫu mô phỏng cho luồng nhập liệu. Nếu đã có nội dung, mẫu được thêm vào cuối và ngăn cách thành chủ đề riêng.</div>' + preserved(sample), btn('Quay lại', 'k-close') + btn('Thêm mẫu vào nội dung', 'k-apply-sample', 'primary', 'data-id="' + e(p.id) + '"'));
  };
  S.actions['k-apply-sample'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    if (S.commit(() => { p.rawText = p.rawText.trim() ? p.rawText + '\n\n---\n\n' + sample : sample; stamp(p, 'Thêm nội dung mẫu có ghi rõ dữ liệu mô phỏng'); }, 'Đã thêm ghi chú mẫu.', false)) { S.closeModal(); S.render(); }
  };
  S.actions['k-structure'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    if (!p.rawText.trim()) return err('Nhập hoặc dán nội dung trước khi sắp xếp.');
    const blocks = p.rawText.split(/^\s*---\s*$/m).filter(t => t.trim());
    const parsed = blocks.map(parseRaw);
    const found = parsed.some(x => Object.keys(x.content).length || x.title);
    if (!found) {
      S.modal('Nội dung đã được giữ', '<div class="notice notice-warning">Bộ sắp xếp mô phỏng chưa nhận ra nhãn trong văn bản này. Nội dung vẫn được lưu; hãy điền biểu mẫu hoặc thêm các nhãn như “Dấu hiệu:”, “Điều kiện:”, “Kiểm tra:”.</div>' + preserved(p.rawText), btn('Giữ nội dung gốc', 'k-close') + btn('Điền biểu mẫu', 'k-manual-from-modal', 'primary'));
      return;
    }
    const body = '<div class="notice notice-info">Xem trước bản sắp xếp mô phỏng. Chỉ sao chép nội dung có nhãn từ bản gốc; không suy luận nguyên nhân. Áp dụng chỉ điền các mục đang trống, giữ những mục bạn đã sửa.</div><form data-form="k-apply-structure" data-id="' + e(p.id) + '" data-version="' + p.version + '"><div class="stack">' + parsed.map((x, i) => '<section class="card"><div class="card-body stack"><label class="check-line"><input type="checkbox" name="blocks" value="' + i + '" checked><strong>' + e(x.title || 'Chủ đề ' + (i + 1)) + '</strong></label><div class="source-meta">' + e(x.family || 'Chưa có loại máy') + ' · ' + Object.keys(x.content).length + '/' + fields.length + ' mục có nội dung</div>' + Object.entries(x.content).map(([key, value]) => '<div><strong>' + e(fields.find(f => f[0] === key)?.[1] || key) + '</strong>' + preserved(value) + '</div>').join('') + '<div class="field-hint">Mục thiếu: ' + e(fields.filter(([key]) => !x.content[key]).map(([, label]) => label).join(', ') || 'Không có') + '</div></div></section>').join('') + '<div class="error-summary" tabindex="-1" hidden></div><div class="actions">' + btn('Giữ biểu mẫu hiện tại', 'k-close') + '<button type="submit" class="btn btn-primary">Dùng các chủ đề đã chọn</button></div></div></form>';
    S.modal('Xem trước nội dung theo biểu mẫu', body);
  };
  S.actions['k-manual-from-modal'] = () => { S.closeModal(); S.go('proposal', S.ui.id, 'form'); };
  S.forms['k-apply-structure'] = function (form) {
    const p = S.db.proposals.find(x => x.id === form.dataset.id); if (!ownership(p)) return;
    if (p.version !== Number(form.dataset.version)) return S.error(form, 'Nội dung đã thay đổi. Đóng và sắp xếp lại bản hiện tại.');
    const selected = new FormData(form).getAll('blocks').map(Number);
    if (!selected.length) return S.error(form, 'Chọn ít nhất một chủ đề hoặc giữ biểu mẫu hiện tại.');
    const blocks = p.rawText.split(/^\s*---\s*$/m).filter(t => t.trim());
    const ok = S.commit(() => {
      selected.forEach((i, idx) => {
        const data = parseRaw(blocks[i]);
        const dest = idx === 0 ? p : baseProposal(p.authorId, p.origin);
        if (!dest.title && data.title) dest.title = data.title;
        if (!dest.family && familyOptions.includes(data.family)) dest.family = data.family;
        Object.entries(data.content).forEach(([key, value]) => { if (!dest.content[key]) dest.content[key] = value; });
        if (idx > 0) { dest.rawText = blocks[i]; dest.sourceProposalId = p.id; dest.sourceRawSnapshot = p.rawText; dest.caseId = p.caseId; dest.contributors = clone(p.contributors || []); S.db.proposals.push(dest); }
        stamp(dest, 'Áp dụng phần trích xuất có nhãn từ nội dung gốc; cần tác giả kiểm tra');
      });
      S.log('proposal.structure', p.id, selected.length + ' chủ đề được áp dụng');
    }, selected.length > 1 ? 'Đã tạo các nháp riêng. Mở từng nháp tại Đề xuất của tôi để hoàn thiện.' : 'Đã điền các mục trống; hãy kiểm tra trước khi đối chiếu.', false);
    if (ok) { S.closeModal(); S.go('proposal', p.id, 'form'); }
  };
  S.actions['k-compare'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    const missing = issues(p);
    if (missing.length || !p.authorConfirmed) {
      S.go('proposal', p.id, 'form');
      return err(missing.length ? 'Cần hoàn thiện: ' + missing.join('; ') + '.' : 'Xác nhận đã đọc và kiểm tra biểu mẫu trước khi đối chiếu.');
    }
    if (S.commit(() => { p.comparison = { version: p.version, at: S.now(), sources: candidates(p) }; addHistory(p, 'compare', 'Đối chiếu kho đã duyệt theo loại máy và từ khóa (mô phỏng)'); S.log('proposal.compare', p.id); }, 'Đã đối chiếu. Đọc nguồn và chọn hướng ghi nhận.', false)) S.go('proposal', p.id, 'compare');
  };
  function submitIssues(p) {
    const list = issues(p);
    if (!p.authorConfirmed) list.push('xác nhận kiểm tra biểu mẫu');
    if (!hasCurrentComparison(p)) list.push('đối chiếu lại nội dung và phiên bản nguồn hiện tại');
    if (!caseSourceCurrent(p)) list.push('đối chiếu lại báo cáo nguồn đã xác nhận mới nhất');
    if (p.mode === 'update' && !p.updateCompleteConfirmed) list.push('xác nhận đã rà toàn bộ nội dung phiên bản kế tiếp');
    if (!(p.rationale || '').trim()) list.push('điểm mới / khác biệt / lý do liên kết');
    if (p.status === 'changes' && !(p.response || '').trim()) list.push('phản hồi với người duyệt');
    if (p.mode === 'link' && p.origin !== 'case') list.push('liên kết chỉ dành cho case công việc');
    if (['update', 'link'].includes(p.mode)) {
      const k = S.db.knowledge.find(k => k.id === p.targetId && k.status === 'published');
      if (!k || k.version !== p.targetVersion) list.push('chọn lại nguồn và phiên bản hiện hành');
      if (k && normalize(k.family) !== normalize(p.family)) list.push('phạm vi loại máy không khớp nguồn mục tiêu');
    }
    const sourceCase = p.origin === 'case' && S.db.cases.find(c => c.id === p.caseId);
    if (p.origin === 'case' && (!sourceCase || sourceCase.reportState !== 'confirmed')) list.push('báo cáo công việc nguồn phải được xác nhận');
    return list;
  }
  S.actions['k-submit-preview'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    const errors = submitIssues(p); if (errors.length) return err('Chưa thể gửi: ' + errors.join('; ') + '.');
    S.modal('Xác nhận gửi kiểm duyệt', '<div class="stack"><div>' + S.badge(modes[p.mode], 'blue') + '<h3>' + e(p.title) + '</h3><p>Tác giả: ' + e(S.person(p.authorId)) + ' · Bản đề xuất ' + p.version + '</p></div><dl class="kv-list"><dt>Nguồn gốc</dt><dd>' + e(p.caseId || 'Kinh nghiệm chuyên gia') + '</dd><dt>Nguồn mục tiêu</dt><dd>' + e(p.targetId ? p.targetId + ' · v' + p.targetVersion : 'Tạo tri thức mới') + '</dd><dt>Căn cứ</dt><dd>' + e(p.rationale) + '</dd></dl><div class="notice notice-info">Bản này sẽ chuyển sang chờ duyệt. Chỉ tri thức được phê duyệt mới xuất hiện trong kho tham khảo.</div></div>', btn('Quay lại chỉnh sửa', 'k-close') + btn('Gửi kiểm duyệt', 'k-submit', 'primary', 'data-id="' + e(p.id) + '" data-version="' + p.version + '"'));
  };
  S.actions['k-submit'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    const errors = submitIssues(p); if (p.version !== Number(el.dataset.version)) errors.push('bản đề xuất đã thay đổi');
    if (errors.length) { S.closeModal(); return err('Chưa thể gửi: ' + errors.join('; ') + '.'); }
    const reviewer = S.db.users.find(u => u.role === 'lead' && u.id !== p.authorId && !contributorIds(p).includes(u.id));
    if (!reviewer) return S.toast('Chưa có người duyệt độc lập phù hợp. Bản nháp được giữ để chờ phân công.', 'warning');
    if (S.commit(() => {
      if (p.status === 'changes') { p.version = proposalVersion(p) + 1; if (p.comparison) p.comparison.version = p.version; }
      p.status = 'pending'; p.reviewerId = reviewer.id; p.submittedAt = S.now(); p.updatedAt = S.now(); p.submissions = p.submissions || [];
      p.submissions.push({ id: S.uid('SUB'), at: S.now(), version: p.version, snapshot: clone({ title: p.title, content: p.content, family: p.family, mode: p.mode, targetId: p.targetId, targetVersion: p.targetVersion, contributors: p.contributors, rationale: p.rationale, response: p.response }) });
      addHistory(p, 'submit', 'Gửi ' + modes[p.mode].toLowerCase() + ' đến ' + S.person(reviewer.id));
      S.notice(reviewer.id, 'Có đề xuất cần kiểm duyệt', p.id + ' — ' + p.title, { page: 'review-detail', id: p.id }); S.log('proposal.submit', p.id, 'v' + p.version);
    }, 'Đã gửi kiểm duyệt. Bạn có thể theo dõi phản hồi tại đề xuất này.', false)) { S.closeModal(); S.render(); }
  };
  S.actions['k-withdraw'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    if (!hasCurrentComparison(p) || !p.targetId || !(p.rationale || '').trim()) return err('Đối chiếu bản hiện tại, chọn nguồn đã có và ghi lý do trùng trước khi lưu trữ.');
    S.modal('Lưu trữ đề xuất trùng', '<p>Đề xuất <strong>' + e(p.id) + '</strong> được lưu trữ và liên kết tới <strong>' + e(p.targetId) + ' v' + e(p.targetVersion) + '</strong>. Nội dung nháp và tác giả vẫn có trong lịch sử.</p>' + preserved(p.rationale), btn('Quay lại', 'k-close') + btn('Xác nhận lưu trữ', 'k-confirm-withdraw', 'primary', 'data-id="' + e(p.id) + '" data-version="' + p.version + '"'));
  };
  S.actions['k-confirm-withdraw'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p)) return;
    if (p.version !== Number(el.dataset.version) || !hasCurrentComparison(p)) return S.toast('Nội dung đã thay đổi; hãy mở lại bước đối chiếu.', 'error');
    if (S.commit(() => { p.status = 'withdrawn'; p.updatedAt = S.now(); addHistory(p, 'withdraw', 'Lưu trữ do trùng với ' + p.targetId + ' v' + p.targetVersion + ': ' + p.rationale); S.log('proposal.withdraw', p.id, p.targetId); }, 'Đã lưu trữ đề xuất trùng; nội dung cũ được giữ.', false)) { S.closeModal(); S.render(); }
  };
  S.actions['k-accept-suggestion'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id); if (!ownership(p) || !p.suggestion) return;
    if (S.commit(() => { p.content[p.suggestion.field] = p.suggestion.text; p.response = 'Đã đọc và áp dụng nội dung người duyệt đề nghị; tiếp tục kiểm tra toàn bộ bản đề xuất.'; p.suggestion.acceptedAt = S.now(); stamp(p, 'Tác giả áp dụng đề nghị sửa; cần xác nhận và đối chiếu lại'); }, 'Đã áp dụng đề nghị. Kiểm tra và đối chiếu lại trước khi gửi.')) return;
  };

  let pendingDecision = null;
  S.forms['k-decision'] = function (form) {
    const p = S.db.proposals.find(x => x.id === form.dataset.id);
    if (!p || S.user().role !== 'lead' || !independent(p) || p.status !== 'pending') return S.error(form, 'Không đủ quyền hoặc đề xuất không còn chờ duyệt.');
    if (p.version !== Number(form.dataset.version)) return S.error(form, 'Bản đề xuất đã thay đổi. Mở lại trước khi quyết định.');
    const fd = new FormData(form);
    const decision = String(fd.get('decision') || '');
    const feedback = String(fd.get('feedback') || '').trim();
    const suggestField = String(fd.get('suggestField') || '');
    const suggestText = String(fd.get('suggestText') || '').trim();
    const editorialTitle = String(fd.get('editorialTitle') || '').trim();
    const editorialNote = String(fd.get('editorialNote') || '').trim();
    if (!['approve', 'changes', 'reject'].includes(decision) || !feedback || !fd.get('reviewConfirmed')) return S.error(form, 'Chọn quyết định, ghi phản hồi và xác nhận đã xem nguồn.');
    if ((suggestField || suggestText) && (!suggestField || !suggestText || decision !== 'changes')) return S.error(form, 'Đề nghị sửa chuyên môn cần có mục, nội dung và quyết định “Yêu cầu bổ sung”.');
    if (editorialTitle !== p.title && (!editorialTitle || !editorialNote)) return S.error(form, 'Chỉnh tiêu đề cần nội dung hợp lệ và ghi chú biên tập.');
    if (decision === 'approve' && issues(p).length) return S.error(form, 'Bản còn thiếu thông tin: ' + issues(p).join('; ') + '. Hãy yêu cầu bổ sung.');
    if (decision === 'approve' && !caseSourceCurrent(p)) return S.error(form, 'Báo cáo nguồn đã thay đổi. Yêu cầu tác giả đối chiếu với bản đã xác nhận mới trước khi duyệt.');
    const target = S.db.knowledge.find(k => k.id === p.targetId && k.status === 'published');
    if (decision === 'approve' && ['update', 'link'].includes(p.mode) && (!target || target.version !== p.targetVersion)) return S.error(form, 'Phiên bản nguồn đã thay đổi. Yêu cầu tác giả đối chiếu và gửi lại trước khi duyệt.');
    if (decision === 'approve' && p.origin === 'case' && !S.db.cases.some(c => c.id === p.caseId && c.reportState === 'confirmed')) return S.error(form, 'Báo cáo nguồn chưa còn ở trạng thái đã xác nhận. Cần đối chiếu lại với tác giả.');
    pendingDecision = { id: p.id, version: p.version, decision, feedback, suggestField, suggestText, editorialTitle, editorialNote };
    S.modal('Xác nhận quyết định', '<div class="stack"><h3>' + e(({ approve: 'Phê duyệt và đưa vào kho', changes: 'Chuyển về tác giả bổ sung', reject: 'Từ chối đề xuất tri thức' })[decision]) + '</h3><p>' + e(p.title) + ' · bản ' + p.version + '</p><div class="notice notice-info">' + e(feedback) + '</div>' + (suggestText ? '<p><strong>Đề nghị sửa:</strong></p>' + preserved(suggestText) : '') + '<p>Quyết định chỉ áp dụng cho đề xuất tri thức; báo cáo và lịch sử công việc nguồn được giữ nguyên.</p></div>', btn('Quay lại', 'k-close') + btn('Xác nhận quyết định', 'k-confirm-decision', 'primary'));
  };
  S.actions['k-confirm-decision'] = function () {
    const d = pendingDecision;
    const p = d && S.db.proposals.find(x => x.id === d.id);
    if (!p || S.user().role !== 'lead' || !independent(p) || p.status !== 'pending' || p.version !== d.version) return S.toast('Đề xuất hoặc quyền đã thay đổi. Mở lại hồ sơ kiểm duyệt.', 'error');
    if (d.decision === 'approve' && !caseSourceCurrent(p)) return S.toast('Báo cáo nguồn đã thay đổi. Cần tác giả đối chiếu và gửi lại.', 'warning');
    const target = S.db.knowledge.find(k => k.id === p.targetId && k.status === 'published');
    if (d.decision === 'approve' && ['update', 'link'].includes(p.mode) && (!target || target.version !== p.targetVersion)) return S.toast('Phiên bản nguồn đã thay đổi. Cần tác giả đối chiếu lại.', 'error');
    const ok = S.commit(() => {
      if (d.editorialTitle !== p.title) { addHistory(p, 'editorial', 'Sửa biên tập tiêu đề: ' + d.editorialNote, { before: p.title, after: d.editorialTitle }); p.title = d.editorialTitle; }
      p.feedback = d.feedback; p.reviewerId = S.user().id; p.reviewedAt = S.now(); p.updatedAt = S.now();
      if (d.decision === 'changes') {
        p.status = 'changes'; p.authorConfirmed = false; p.response = ''; p.suggestion = d.suggestText ? { field: d.suggestField, text: d.suggestText, authorId: S.user().id, at: S.now() } : null;
        addHistory(p, 'changes', 'Yêu cầu bổ sung: ' + d.feedback);
      } else if (d.decision === 'reject') {
        p.status = 'rejected'; addHistory(p, 'reject', 'Từ chối: ' + d.feedback);
      } else {
        const authorContributors = [...new Set([p.authorId, ...contributorIds(p)])];
        if (p.mode === 'link') {
          p.publishedId = target.id; p.publishedVersion = target.version;
          p.approvedLink = { caseId: p.caseId, knowledgeId: target.id, version: target.version, approvedBy: S.user().id, approvedAt: S.now() };
        } else if (p.mode === 'update') {
          const old = clone(target); delete old.history;
          target.history = target.history || []; target.history.push(old);
          Object.assign(target, { title: p.title, family: p.family, content: clone(p.content), causeStatus: p.causeStatus, contributors: [...new Set([target.authorId, ...contributorIds(target), ...authorContributors])], revisionAuthorId: p.authorId, reviewerId: S.user().id, version: Number(target.version) + 1, updatedAt: S.now(), proposalId: p.id, contextDetails: clone(p.contextDetails || {}), changes5m: clone(p.changes5m || {}) });
          p.publishedId = target.id; p.publishedVersion = target.version;
        } else {
          const id = S.uid(p.origin === 'case' ? 'CS' : 'KN');
          S.db.knowledge.push({ id, title: p.title, family: p.family, assetIds: p.caseId ? [S.db.cases.find(c => c.id === p.caseId)?.assetId].filter(Boolean) : [], kind: p.origin === 'case' ? 'case' : 'expert', authorId: p.authorId, reviewerId: S.user().id, contributors: authorContributors, version: 1, status: 'published', updatedAt: S.now(), tags: [], content: clone(p.content), history: [], causeStatus: p.causeStatus, proposalId: p.id, caseId: p.caseId || null, contextDetails: clone(p.contextDetails || {}), changes5m: clone(p.changes5m || {}) });
          p.publishedId = id; p.publishedVersion = 1;
        }
        p.status = 'published'; p.readyAt = S.now(); addHistory(p, 'approve', (p.mode === 'link' ? 'Duyệt liên kết ' : 'Duyệt và xuất bản ') + p.publishedId + ' v' + p.publishedVersion + ': ' + d.feedback);
      }
      S.notice(p.authorId, d.decision === 'approve' ? 'Đề xuất đã được duyệt' : d.decision === 'changes' ? 'Đề xuất cần bổ sung' : 'Đề xuất đã bị từ chối', p.id + ' — ' + d.feedback, { page: 'proposal', id: p.id });
      S.log('proposal.' + d.decision, p.id, d.feedback);
    }, d.decision === 'approve' ? 'Đã duyệt và cập nhật kho tri thức mô phỏng.' : 'Đã lưu quyết định và gửi phản hồi cho tác giả.', false);
    if (ok) { pendingDecision = null; S.closeModal(); S.render(); }
  };
  S.actions['k-case-source'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id);
    if (!accessible(p)) return;
    const liveCase = S.db.cases.find(x => x.id === p.caseId);
    if (!liveCase && !p.caseSourceSnapshot) return S.toast('Không tìm thấy hồ sơ nguồn trong dữ liệu demo.', 'warning');
    const c = p.caseSourceSnapshot || liveCase;
    const report = p.reportSnapshot || c.report || {};
    const sourceNotice = '<div class="notice notice-info">Bản báo cáo nguồn tại thời điểm tạo đề xuất · ' + e(report.id || '') + ' · revision ' + e(report.revision || 1) + '. Kiểm duyệt tri thức không sửa báo cáo hay kết quả công việc này.</div>' + ((liveCase?.report?.revision !== report.revision || liveCase?.reportState !== 'confirmed') ? '<div class="notice notice-warning">Báo cáo hiện tại đang được đính chính hoặc đã có phiên bản khác. Bản nguồn đã chọn được giữ nguyên để đối chiếu; cần xác minh trước khi duyệt tri thức.</div>' : '');
    const raw = typeof report.summary === 'string' ? report.summary : JSON.stringify(report.summary || '', null, 2);
    S.modal('Báo cáo nguồn · ' + c.id, '<div class="stack">' + sourceNotice + '<h3>' + e(c.title) + '</h3><dl class="kv-list"><dt>Máy</dt><dd>' + e(c.assetId) + '</dd><dt>Người phụ trách</dt><dd>' + e(S.person(c.ownerId)) + '</dd><dt>Trạng thái báo cáo</dt><dd>' + e(c.reportState === 'confirmed' ? 'Đã xác nhận' : c.reportState) + '</dd><dt>Số đợt xử lý</dt><dd>' + (c.rounds || []).length + '</dd></dl><h3>Tổng kết</h3>' + preserved(raw) + '<h3>Nguyên nhân / trạng thái xác minh</h3>' + preserved(report.cause) + '<h3>Bài học</h3>' + preserved(report.lessons) + '<h3>Giới hạn</h3>' + preserved(report.limits) + '<h3>Các đợt và ghi nhận</h3>' + (c.rounds || []).map((r, i) => '<section class="card"><div class="card-body"><h4>Đợt ' + (i + 1) + ' · ' + e(r.id || '') + '</h4>' + preserved(r.summary || r.result || '') + '<div class="stack">' + (r.events || r.entries || []).map(ev => '<div><strong>' + e(S.person(ev.performedBy || ev.performerId || c.ownerId)) + '</strong><span class="source-meta"> · người nhập ' + e(S.person(ev.enteredBy || ev.recordedBy || c.ownerId)) + '</span>' + preserved(ev.content || ev.text || ev.note) + '</div>').join('') + '</div></div></section>').join('') + '</div>', btn('Đóng báo cáo nguồn', 'k-close', 'primary'));
  };
  S.actions['k-submission'] = function (el) {
    const p = S.db.proposals.find(x => x.id === el.dataset.id);
    if (!accessible(p)) return;
    const sub = (p.submissions || []).find(x => x.id === el.dataset.submission);
    if (!sub) return S.toast('Không tìm thấy bản đã gửi.', 'warning');
    const snapshot = sub.snapshot;
    S.modal(p.id + ' · Bản đã gửi ' + sub.version, '<div class="stack"><div class="notice notice-info">Bản chụp lúc gửi ' + e(S.fmtDate(sub.at)) + '. Đây là nội dung lịch sử chỉ đọc.</div><h3>' + e(snapshot.title) + '</h3><p>' + e(modes[snapshot.mode]) + ' · ' + e(snapshot.family) + '</p><h3>Căn cứ và phản hồi của tác giả</h3>' + preserved(snapshot.rationale) + preserved(snapshot.response) + contentView(snapshot.content) + '</div>', btn('Đóng bản lịch sử', 'k-close', 'primary'));
  };
  S.createCaseProposal = function (caseRecord) {
    const c = caseRecord && S.db.cases.find(x => x.id === caseRecord.id);
    if (!c || c.reportState !== 'confirmed' || c.ownerId !== S.user().id || S.user().role !== 'maintenance') return S.toast('Chỉ người phụ trách có thể đề xuất từ báo cáo công việc đã xác nhận.', 'error');
    const existing = S.db.proposals.find(p => p.caseId === c.id && p.authorId === S.user().id && ['draft', 'changes', 'pending'].includes(p.status));
    if (existing) { S.toast('Đã có đề xuất cho hồ sơ này; mở bản hiện có để tiếp tục.', 'info'); S.go('proposal', existing.id); return existing.id; }
    const r = c.report || {};
    const asset = S.asset(c.assetId);
    const p = baseProposal(S.user().id, 'case');
    const allEvents = (c.rounds || []).flatMap(round => round.events || round.entries || []);
    const toText = value => typeof value === 'string' ? value : value ? JSON.stringify(value, null, 2) : '';
    const eventLine = ev => toText(ev.content || ev.text || ev.note) + (ev.result ? ' — Kết quả: ' + ev.result : '') + (ev.rationale ? ' — Lý do: ' + ev.rationale : '');
    const eventText = allEvents.filter(ev => ['observation', 'check', 'hypothesis'].includes(ev.type)).map(eventLine).filter(Boolean).join('\n');
    const actionText = allEvents.filter(ev => ev.type === 'action').map(eventLine).join('\n');
    const context = c.context || {};
    const contextText = [['Model máy', asset?.model], ['Model sản phẩm', context.productModel], ['Line', asset?.line], ['Chế độ', context.mode], ['Tốc độ', context.speed], ['Ca', context.shift], ['Môi trường', context.environment], ['Thời điểm', context.onset]].filter(([,value]) => value).map(([label,value]) => label + ': ' + value).join('\n');
    const changeText = (context.changes || []).map(x => x.group + ': ' + ({ changed: 'Có thay đổi', none: 'Chưa ghi nhận thay đổi', unchecked: 'Chưa kiểm tra' }[x.status] || x.status) + (x.detail ? ' — ' + x.detail : '')).join('\n');
    const machineLabel = { restored: 'Đã phục hồi', unrestored: 'Chưa phục hồi', unverified: 'Chưa đủ kiểm chứng' }[c.machineState] || c.machineState;
    const safetyText = (c.selectedSources || []).map(src => S.getKnowledge(src.id, src.version)?.content?.safety).filter(Boolean).join('\n');
    Object.assign(p, { title: c.title, family: asset?.family || '', caseId: c.id, reportSnapshot: clone(r), caseSourceSnapshot: clone(c), reportSourceAt: c.updatedAt, contributors: [...new Set([...(c.participants || []), ...allEvents.map(ev => ev.performedBy || ev.performerId)].filter(id => id && id !== c.ownerId))], rawText: toText(r.summary), content: { symptom: toText(context.symptom || c.symptom || r.symptom || c.title), context: contextText + (changeText ? '\nĐiểm thay đổi 5M1E:\n' + changeText : ''), checks: toText(r.checks || eventText), solution: toText(r.actions || r.solution || actionText), result: machineLabel + (c.resultEvidence ? '\nCăn cứ: ' + c.resultEvidence : ''), cause: toText(r.cause), evidence: 'Báo cáo đã xác nhận ' + c.id + ', ' + r.id + ' revision ' + r.revision + '; ' + (c.rounds || []).length + ' đợt xử lý. Xem bản nguồn để đối chiếu từng ghi nhận.', safety: toText(r.safety || safetyText), limits: toText(r.limits || '') }, contextDetails: { machineModel: asset?.model || '', productModel: context.productModel || '', mode: context.mode || '', speed: context.speed || '', line: asset?.line || '', shift: context.shift || '' }, changes5m: Object.fromEntries((context.changes || []).flatMap((x,i) => [['m'+i,x.status],['d'+i,x.detail||'']])), causeStatus: r.causeStatus || 'unknown', rationale: toText(r.lessons) });
    if (S.commit(() => { S.db.proposals.push(p); addHistory(p, 'draft', 'Tạo đề xuất từ báo cáo đã xác nhận ' + c.id + '; giữ bản chụp báo cáo nguồn'); S.log('proposal.from-case', p.id, c.id); }, 'Đã tạo nháp tri thức. Kiểm tra, bổ sung và đối chiếu trước khi gửi.', false)) { S.go('proposal', p.id, 'form'); return p.id; }
  };
})();
