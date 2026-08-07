(function () {
  'use strict';

  const DATA_ROOT = '../data';
  const CATEGORY_ORDER = ['unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'];
  const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'];
  const ENVIRONMENT_ORDER = ['dev', 'stage', 'prod'];
  const TYPE_ORDER = ['manual', 'automated', 'both'];
  const AUTOMATION_ORDER = ['automated', 'not_automated', 'planned', 'flaky'];
  const STATUS_ORDER = ['active', 'draft', 'deprecated'];
  const RESULT_ORDER = ['fail', 'blocked', 'not_run', 'skipped', 'pass'];
  const DEFAULT_ACTIVE_STATUSES = ['active', 'draft'];
  const MAX_TAG_CHIPS = 60;
  const RUN_BY_STORAGE_KEY = 'vtms.runBy';

  // Defects (recordKind: 'defect') are a genuinely different record shape than test
  // cases — severity + status lifecycle + narrative, not steps/expectedResult/automation.
  // The Category chip-group slot is reused for Severity and the Result chip-group slot
  // is reused for Status; Priority/Type/Automation/(lifecycle-)Status have no defect
  // equivalent and are hidden. See isDefectsSystem() below.
  const DEFECT_SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
  const DEFECT_STATUS_ORDER = ['open', 'new', 'in_progress', 'regressed', 'wont_fix', 'cannot_verify', 'fixed'];

  const DEFAULT_SYSTEM = { slug: 'modules', name: 'Module Test Management System', entityLabel: 'Module', dataDir: 'modules', description: '' };

  const state = {
    systems: [],
    currentSystem: 'modules',
    allCases: [],
    moduleMeta: {}, // slug -> meta
    active: {
      category: new Set(),
      priority: new Set(),
      environment: new Set(),
      type: new Set(),
      automation: new Set(),
      status: new Set(DEFAULT_ACTIVE_STATUSES),
      result: new Set(),
      tag: new Set(),
      module: new Set(),
    },
    search: '',
    moduleSearch: '',
    sort: { key: 'id', dir: 'asc' },
    openDetailId: null,
  };

  function getExecutionResult(c) {
    return (c.execution && c.execution.result) || 'not_run';
  }

  const el = (id) => document.getElementById(id);

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }

  function currentSystemDef() {
    return state.systems.find((s) => s.slug === state.currentSystem) || DEFAULT_SYSTEM;
  }

  function isDefectsSystem() {
    return currentSystemDef().recordKind === 'defect';
  }

  // Each system gets its own bookmarkable/shareable URL: /app/modules, /app/defects,
  // etc. No trailing slash — see the matching comment in server.js for why that
  // matters (it's what keeps index.html's relative asset paths resolving correctly).
  function systemSlugFromUrl() {
    const match = window.location.pathname.match(/^\/app\/([a-z0-9-]+)\/?$/);
    return match ? match[1] : null;
  }

  function updateUrlForSystem(slug, { replace } = {}) {
    const url = `/app/${slug}`;
    if (window.location.pathname.replace(/\/$/, '') === url) return;
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ system: slug }, '', url);
  }

  async function loadSystemsIndex() {
    const manifest = await fetchJson(`${DATA_ROOT}/manifest.json`);
    state.systems = (manifest.systems && manifest.systems.length) ? manifest.systems : [DEFAULT_SYSTEM];
    const urlSlug = systemSlugFromUrl();
    if (urlSlug && state.systems.some((s) => s.slug === urlSlug)) {
      state.currentSystem = urlSlug;
    } else if (!state.systems.some((s) => s.slug === state.currentSystem)) {
      state.currentSystem = state.systems[0].slug;
    }
    // Normalize the address bar to the resolved system (e.g. /app/ -> /app/modules,
    // or an unrecognized slug -> the default) without adding a history entry.
    updateUrlForSystem(state.currentSystem, { replace: true });
  }

  async function loadData() {
    el('load-status').textContent = 'Loading...';
    const dataDir = currentSystemDef().dataDir;
    const manifest = await fetchJson(`${DATA_ROOT}/${dataDir}/manifest.json`);
    const categories = manifest.categories && manifest.categories.length ? manifest.categories : CATEGORY_ORDER;
    const entities = manifest.entities || [];

    state.moduleMeta = {};
    const perModule = await Promise.all(
      entities.map(async (m) => {
        let meta = { slug: m.slug, name: m.name };
        try {
          meta = await fetchJson(`${DATA_ROOT}/${dataDir}/${m.slug}/_meta.json`);
        } catch (e) {
          console.warn('No _meta.json for entity', m.slug);
        }
        state.moduleMeta[m.slug] = meta;

        const results = await Promise.allSettled(
          categories.map((cat) => fetchJson(`${DATA_ROOT}/${dataDir}/${m.slug}/${cat}.json`))
        );
        const cases = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) cases.push(...r.value);
        });
        return cases;
      })
    );

    state.allCases = perModule.flat();
    const label = (currentSystemDef().entityLabel || 'Module') + 's';
    const recordLabel = isDefectsSystem() ? 'defects' : 'test cases';
    el('load-status').textContent = `Loaded ${state.allCases.length} ${recordLabel} across ${entities.length} ${label}`;
  }

  function countBy(cases, field) {
    const counts = {};
    cases.forEach((c) => {
      const v = c[field];
      if (v === undefined || v === null || v === '') return;
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }

  function countByTag(cases) {
    const counts = {};
    cases.forEach((c) => (c.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    return counts;
  }

  // environment is an array field (a case can run in more than one tier), so it's
  // counted/filtered the same way as tags rather than via the single-value countBy().
  function countByEnvironment(cases) {
    const counts = {};
    cases.forEach((c) => (c.environment || []).forEach((e) => (counts[e] = (counts[e] || 0) + 1)));
    return counts;
  }

  function countByModule(cases) {
    const counts = {};
    cases.forEach((c) => (counts[c.module] = (counts[c.module] || 0) + 1));
    return counts;
  }

  function countByExecutionResult(cases) {
    const counts = {};
    cases.forEach((c) => {
      const r = getExecutionResult(c);
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }

  function renderStats() {
    if (isDefectsSystem()) return renderDefectStats();

    const total = state.allCases.length;
    const active = state.allCases.filter((c) => c.status !== 'deprecated').length;
    const catCounts = countBy(state.allCases, 'category');
    const p0 = countBy(state.allCases, 'priority').P0 || 0;
    const automated = countBy(state.allCases, 'automationStatus').automated || 0;
    const resultCounts = countByExecutionResult(state.allCases);

    const tiles = [
      { label: 'Total test cases', value: total },
      { label: 'Active', value: active },
      { label: 'P0 (blocking)', value: p0 },
      { label: 'Automated', value: automated },
      { label: 'Passed', value: resultCounts.pass || 0 },
      { label: 'Failed', value: resultCounts.fail || 0 },
      { label: 'Blocked', value: resultCounts.blocked || 0 },
      { label: 'Not run', value: resultCounts.not_run || 0 },
      ...CATEGORY_ORDER.filter((c) => catCounts[c]).map((c) => ({ label: c, value: catCounts[c] })),
    ];

    el('stats').innerHTML = tiles
      .map((t) => `<div class="stat-tile"><div class="stat-tile__value">${t.value}</div><div class="stat-tile__label">${t.label}</div></div>`)
      .join('');
  }

  function renderDefectStats() {
    const total = state.allCases.length;
    const statusCounts = countBy(state.allCases, 'status');
    const sevCounts = countBy(state.allCases, 'severity');

    const tiles = [
      { label: 'Total defects', value: total },
      { label: 'Open', value: statusCounts.open || 0 },
      { label: 'Fixed', value: statusCounts.fixed || 0 },
      { label: 'Regressed', value: statusCounts.regressed || 0 },
      ...DEFECT_SEVERITY_ORDER.filter((s) => sevCounts[s]).map((s) => ({ label: s, value: sevCounts[s] })),
    ];

    el('stats').innerHTML = tiles
      .map((t) => `<div class="stat-tile"><div class="stat-tile__value">${t.value}</div><div class="stat-tile__label">${t.label}</div></div>`)
      .join('');
  }

  function chipGroup(containerId, facetKey, order, counts, labelFn, strict) {
    const container = el(containerId);
    const values = strict
      ? order.filter((v) => counts[v])
      : order.filter((v) => counts[v]).concat(Object.keys(counts).filter((v) => !order.includes(v)));
    container.innerHTML = values
      .map((v) => {
        const active = state.active[facetKey].has(v);
        const label = labelFn ? labelFn(v) : v;
        return `<span class="chip${active ? ' active' : ''}" data-facet="${facetKey}" data-value="${escapeAttr(v)}">${escapeHtml(label)} <span class="count">${counts[v]}</span></span>`;
      })
      .join('');
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const set = state.active[facetKey];
        const value = chip.dataset.value;
        if (set.has(value)) set.delete(value);
        else set.add(value);
        renderAll();
      });
    });
  }

  function renderModuleList() {
    const counts = countByModule(state.allCases);
    const container = el('filter-module');
    const search = state.moduleSearch.toLowerCase();
    // Show every entity registered for the current system, even ones with zero
    // test cases so far (all entities in the new systems start at zero until
    // content is authored in a later phase) — not just entities with cases.
    const modules = Object.values(state.moduleMeta)
      .filter((m) => !search || m.name.toLowerCase().includes(search) || m.slug.includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = modules
      .map((m) => {
        const active = state.active.module.has(m.slug);
        return `<div class="module-item${active ? ' active' : ''}" data-slug="${escapeAttr(m.slug)}">
          <span>${escapeHtml(m.name)}</span><span class="count">${counts[m.slug] || 0}</span>
        </div>`;
      })
      .join('');

    container.querySelectorAll('.module-item').forEach((item) => {
      item.addEventListener('click', () => {
        const slug = item.dataset.slug;
        if (state.active.module.has(slug)) state.active.module.delete(slug);
        else state.active.module.add(slug);
        renderAll();
      });
    });
  }

  function setFilterGroupVisible(key, visible) {
    const group = el(`filtergroup-${key}`);
    if (group) group.style.display = visible ? '' : 'none';
  }

  function renderFilters() {
    const defectsMode = isDefectsSystem();
    setFilterGroupVisible('priority', !defectsMode);
    setFilterGroupVisible('environment', !defectsMode);
    setFilterGroupVisible('type', !defectsMode);
    setFilterGroupVisible('automation', !defectsMode);
    setFilterGroupVisible('status', !defectsMode);

    if (defectsMode) {
      chipGroup('filter-category', 'category', DEFECT_SEVERITY_ORDER, countBy(state.allCases, 'severity'));
      chipGroup('filter-result', 'result', DEFECT_STATUS_ORDER, countBy(state.allCases, 'status'), (v) => v.replace('_', ' '));
    } else {
      chipGroup('filter-category', 'category', CATEGORY_ORDER, countBy(state.allCases, 'category'));
      chipGroup('filter-priority', 'priority', PRIORITY_ORDER, countBy(state.allCases, 'priority'));
      chipGroup('filter-environment', 'environment', ENVIRONMENT_ORDER, countByEnvironment(state.allCases), (v) => v.charAt(0).toUpperCase() + v.slice(1));
      chipGroup('filter-type', 'type', TYPE_ORDER, countBy(state.allCases, 'type'));
      chipGroup('filter-result', 'result', RESULT_ORDER, countByExecutionResult(state.allCases), (v) => v.replace('_', ' '));
      chipGroup('filter-automation', 'automation', AUTOMATION_ORDER, countBy(state.allCases, 'automationStatus'), (v) => v.replace('_', ' '));
      chipGroup('filter-status', 'status', STATUS_ORDER, countBy(state.allCases, 'status'));
    }

    const tagCounts = countByTag(state.allCases);
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TAG_CHIPS)
      .map(([t]) => t);
    chipGroup('filter-tag', 'tag', topTags, tagCounts, null, true);

    renderModuleList();
  }

  function renderSystemTabs() {
    const container = el('system-tabs');
    if (!container) return;
    container.innerHTML = state.systems
      .map((s) => {
        const active = s.slug === state.currentSystem;
        return `<button type="button" class="system-tab${active ? ' active' : ''}" data-system="${escapeAttr(s.slug)}">${escapeHtml(s.name)}</button>`;
      })
      .join('');
    container.querySelectorAll('.system-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchSystem(btn.dataset.system));
    });
  }

  function renderSystemLabels() {
    const sys = currentSystemDef();
    const label = sys.entityLabel || 'Module';
    const heading = el('filter-module-heading');
    if (heading) heading.textContent = label;
    const moduleSearchInput = el('module-search');
    if (moduleSearchInput) moduleSearchInput.placeholder = `Filter ${label.toLowerCase()}s...`;
    const subtitle = el('app-subtitle');
    if (subtitle) subtitle.textContent = sys.description || 'Modular test case repository — filter, review, and export for SDET & release testing';

    const categoryHeading = el('filter-category-heading');
    if (categoryHeading) categoryHeading.textContent = isDefectsSystem() ? 'Severity' : 'Category';
    const resultHeading = el('filter-result-heading');
    if (resultHeading) resultHeading.textContent = isDefectsSystem() ? 'Status' : 'Result';
  }

  function renderTableHead() {
    const row = el('table-head-row');
    if (!row) return;
    const moduleLabel = currentSystemDef().entityLabel || 'Module';
    const cols = isDefectsSystem()
      ? [
          { key: 'id', label: 'ID' },
          { key: 'module', label: moduleLabel },
          { key: 'severity', label: 'Severity' },
          { key: 'category', label: 'Category' },
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' },
        ]
      : [
          { key: 'id', label: 'ID' },
          { key: 'module', label: moduleLabel },
          { key: 'category', label: 'Category' },
          { key: 'subFeature', label: 'Sub-feature' },
          { key: 'title', label: 'Title' },
          { key: 'priority', label: 'Priority' },
          { key: 'environment', label: 'Environment' },
          { key: 'type', label: 'Type' },
          { key: 'automationStatus', label: 'Automation' },
          { key: 'status', label: 'Status' },
          { key: 'result', label: 'Result' },
        ];
    row.innerHTML = cols.map((c) => `<th data-sort="${c.key}">${escapeHtml(c.label)}</th>`).join('');
    row.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.sort = { key, dir: 'asc' };
        renderTable(getFilteredCases());
      });
    });
  }

  function resetFilters() {
    state.active = {
      category: new Set(), priority: new Set(), environment: new Set(), type: new Set(), automation: new Set(),
      // The 'status' facet slot is hidden entirely in defects mode, but a defect object
      // ALSO has its own 'status' field (open/fixed/...) — if this defaulted to
      // DEFAULT_ACTIVE_STATUSES (active/draft, meaningless for a defect) it would
      // silently filter every defect out. Keep it empty whenever it's not shown.
      status: new Set(isDefectsSystem() ? [] : DEFAULT_ACTIVE_STATUSES),
      result: new Set(), tag: new Set(), module: new Set(),
    };
    state.search = '';
    state.moduleSearch = '';
    const searchInput = el('search');
    if (searchInput) searchInput.value = '';
    const moduleSearchInput = el('module-search');
    if (moduleSearchInput) moduleSearchInput.value = '';
  }

  async function switchSystem(slug, { updateUrl = true } = {}) {
    if (slug === state.currentSystem) return;
    if (!state.systems.some((s) => s.slug === slug)) return;
    state.currentSystem = slug;
    if (updateUrl) updateUrlForSystem(slug);
    resetFilters();
    closeDetail();
    renderSystemTabs();
    renderSystemLabels();
    renderTableHead();
    try {
      await loadData();
    } catch (err) {
      el('load-status').textContent = `Failed to load data: ${err.message}`;
      console.error(err);
    }
    renderStats();
    renderAll();
  }

  function getFilteredCases() {
    const search = state.search.trim().toLowerCase();
    const defectsMode = isDefectsSystem();
    return state.allCases.filter((c) => {
      if (defectsMode) {
        if (state.active.category.size && !state.active.category.has(c.severity)) return false;
        if (state.active.result.size && !state.active.result.has(c.status)) return false;
      } else {
        if (state.active.category.size && !state.active.category.has(c.category)) return false;
        if (state.active.priority.size && !state.active.priority.has(c.priority)) return false;
        // environment is multi-value (a case can run in more than one tier) — match
        // on any overlap with the active selection, same as the tag facet below.
        if (state.active.environment.size && !(c.environment || []).some((e) => state.active.environment.has(e))) return false;
        if (state.active.type.size && !state.active.type.has(c.type)) return false;
        if (state.active.automation.size && !state.active.automation.has(c.automationStatus)) return false;
        if (state.active.status.size && !state.active.status.has(c.status)) return false;
        if (state.active.result.size && !state.active.result.has(getExecutionResult(c))) return false;
      }
      if (state.active.module.size && !state.active.module.has(c.module)) return false;
      if (state.active.tag.size && !(c.tags || []).some((t) => state.active.tag.has(t))) return false;
      if (search) {
        const haystack = (defectsMode
          ? [c.id, c.title, c.description, c.category, c.component, c.requirement, ...(c.tags || []), ...(c.affectedFiles || [])]
          : [c.id, c.title, c.description, c.subFeature, c.testData, c.expectedResult, ...(c.tags || []), ...(c.environment || []), ...(c.preconditions || []), ...(c.steps || [])]
        )
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function sortValue(c, key) {
    if (key === 'result') return isDefectsSystem() ? c.status : getExecutionResult(c);
    // environment is an array (e.g. ["dev","stage"]) — sort by its members joined in
    // ENVIRONMENT_ORDER so "dev" < "dev, stage" < "stage" < "stage, prod" reads naturally.
    if (key === 'environment') return (c.environment || []).slice().sort((a, b) => ENVIRONMENT_ORDER.indexOf(a) - ENVIRONMENT_ORDER.indexOf(b)).join(',');
    return c[key];
  }

  function sortCases(cases) {
    const { key, dir } = state.sort;
    const sorted = [...cases].sort((a, b) => {
      const av = (sortValue(a, key) ?? '').toString();
      const bv = (sortValue(b, key) ?? '').toString();
      return av.localeCompare(bv, undefined, { numeric: true });
    });
    if (dir === 'desc') sorted.reverse();
    return sorted;
  }

  function moduleName(slug) {
    return state.moduleMeta[slug] ? state.moduleMeta[slug].name : slug;
  }

  function defectRowHtml(c) {
    return `<tr data-id="${escapeAttr(c.id)}">
      <td>${escapeHtml(c.id)}</td>
      <td>${escapeHtml(moduleName(c.module))}</td>
      <td><span class="badge badge--${escapeAttr(c.severity)}">${escapeHtml(c.severity)}</span></td>
      <td>${escapeHtml(c.category || '—')}</td>
      <td>${escapeHtml(c.title)}</td>
      <td><span class="badge badge--${escapeAttr(c.status)}">${escapeHtml((c.status || '').replace('_', ' '))}</span></td>
    </tr>`;
  }

  // c.environment is optional (older/unclassified cases) and, when present, an array —
  // rendered as a small stack of badges rather than the single-value badge--X pattern
  // used elsewhere, since a case can legitimately run in more than one tier.
  function environmentBadgesHtml(c) {
    if (!c.environment || !c.environment.length) return '<span class="text-muted">—</span>';
    return `<span class="env-badges">${c.environment
      .map((e) => `<span class="badge badge--env-${escapeAttr(e)}">${escapeHtml(e)}</span>`)
      .join('')}</span>`;
  }

  function testCaseRowHtml(c) {
    return `<tr data-id="${escapeAttr(c.id)}">
      <td>${escapeHtml(c.id)}</td>
      <td>${escapeHtml(moduleName(c.module))}</td>
      <td><span class="cat-tag">${escapeHtml(c.category)}</span></td>
      <td>${escapeHtml(c.subFeature || '—')}</td>
      <td>${escapeHtml(c.title)}</td>
      <td><span class="badge badge--${escapeAttr(c.priority)}">${escapeHtml(c.priority)}</span></td>
      <td>${environmentBadgesHtml(c)}</td>
      <td>${escapeHtml(c.type)}</td>
      <td><span class="badge badge--${escapeAttr(c.automationStatus || 'not_automated')}">${escapeHtml((c.automationStatus || '—').replace('_', ' '))}</span></td>
      <td><span class="badge badge--${escapeAttr(c.status)}">${escapeHtml(c.status)}</span></td>
      <td><span class="badge badge--${escapeAttr(getExecutionResult(c))}">${escapeHtml(getExecutionResult(c).replace('_', ' '))}</span></td>
    </tr>`;
  }

  function renderTable(filtered) {
    const rows = sortCases(filtered);
    const defectsMode = isDefectsSystem();
    const recordLabel = defectsMode ? 'defects' : 'test cases';
    el('result-count').textContent = `Showing ${rows.length} of ${state.allCases.length} ${recordLabel}`;

    const colCount = defectsMode ? 6 : 11;
    if (!rows.length) {
      el('table-body').innerHTML = `<tr class="empty-row"><td colspan="${colCount}">No ${recordLabel} match the current filters.</td></tr>`;
      return;
    }

    el('table-body').innerHTML = rows.map((c) => (defectsMode ? defectRowHtml(c) : testCaseRowHtml(c))).join('');

    el('table-body').querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => openDetail(tr.dataset.id));
    });
  }

  function openDetail(id) {
    const c = state.allCases.find((x) => x.id === id);
    if (!c) return;
    state.openDetailId = id;
    if (isDefectsSystem()) return renderDefectDetail(c);
    renderTestCaseDetail(c);
  }

  function renderDefectDetail(c) {
    const section = (title, body) => (body ? `<div class="detail-section"><h4>${title}</h4>${body}</div>` : '');
    const bareList = (items) => (items && items.length ? `<ul>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '');
    const verifiedBadge = c.verified === true ? '<span class="badge">Verified</span>' : (c.verified === false ? '<span class="badge">Unverified</span>' : '');

    const statusOptions = DEFECT_STATUS_ORDER
      .map((v) => `<option value="${v}"${c.status === v ? ' selected' : ''}>${v.replace('_', ' ')}</option>`)
      .join('');

    el('detail-content').innerHTML = `
      <div class="detail-id">${escapeHtml(c.id)} · ${escapeHtml(moduleName(c.module))}</div>
      <h2>${escapeHtml(c.title)}</h2>
      <div class="detail-badges">
        <span class="badge badge--${escapeAttr(c.severity)}">${escapeHtml(c.severity)}</span>
        <span class="badge badge--${escapeAttr(c.status)}">${escapeHtml((c.status || '').replace('_', ' '))}</span>
        ${verifiedBadge}
      </div>

      <div class="detail-section detail-section--edit">
        <h4>Status</h4>
        <label for="detail-defect-status">Status</label>
        <select id="detail-defect-status">${statusOptions}</select>
        <label for="detail-defect-status-note">Status note (optional)</label>
        <input type="text" id="detail-defect-status-note" value="${escapeAttr(c.statusRaw || '')}" placeholder="e.g. Verified fixed in PR #123" />
        <button type="button" class="btn btn--secondary" data-action="save-defect-status">Save status</button>
        <div id="detail-defect-status-msg" class="save-status"></div>
      </div>

      ${section('Description', c.description ? `<p>${escapeHtml(c.description)}</p>` : '')}
      ${section('Category', c.category ? `<p>${escapeHtml(c.category)}</p>` : '')}
      ${section('Component', c.component ? `<p>${escapeHtml(c.component)}</p>` : '')}
      ${section('Requirement', c.requirement ? `<p>${escapeHtml(c.requirement)}</p>` : '')}
      ${section('Affected files', bareList(c.affectedFiles))}
      ${section('Tags', c.tags && c.tags.length ? `<div class="chip-group">${c.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>` : '')}
      ${section('Fix evidence', c.fixEvidence ? `<p>${escapeHtml(c.fixEvidence)}</p>` : '')}
      ${section('Timeline', (c.firstDetected || c.lastVerified || c.runsOpen !== undefined) ? `<p>First detected ${escapeHtml(c.firstDetected || '—')} · Last verified ${escapeHtml(c.lastVerified || '—')}${c.runsOpen !== undefined ? ` · Runs open ${escapeHtml(String(c.runsOpen))}` : ''}</p>` : '')}
      ${section('Source', `<p>${escapeHtml(c.sourceFile || '—')}${c.sourceRun ? ` · ${escapeHtml(c.sourceRun)}` : ''}</p>`)}
    `;
    el('detail-overlay').classList.remove('hidden');
  }

  function renderTestCaseDetail(c) {
    const section = (title, body) => (body ? `<div class="detail-section"><h4>${title}</h4>${body}</div>` : '');
    const list = (items) => (items && items.length ? `<ol>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : '');
    const bareList = (items) => (items && items.length ? `<ul>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '');

    const result = getExecutionResult(c);
    const exec = c.execution || {};
    const savedRunBy = localStorage.getItem(RUN_BY_STORAGE_KEY) || '';
    const resultButtons = ['pass', 'fail', 'blocked', 'skipped']
      .map((v) => `<button type="button" class="btn btn--result btn--${v}${result === v ? ' active' : ''}" data-action="set-result" data-value="${v}">${v.charAt(0).toUpperCase() + v.slice(1)}</button>`)
      .join('');
    const lastRunLine = exec.runAt
      ? `<div class="detail-meta">Last run: <strong>${escapeHtml(result.replace('_', ' '))}</strong> on ${escapeHtml(exec.runAt)}${exec.runBy ? ` by ${escapeHtml(exec.runBy)}` : ''}</div>`
      : '';

    const automationOptions = ['', 'automated', 'not_automated', 'planned', 'flaky']
      .map((v) => `<option value="${v}"${(c.automationStatus || '') === v ? ' selected' : ''}>${v ? v.replace('_', ' ') : '— unset —'}</option>`)
      .join('');

    el('detail-content').innerHTML = `
      <div class="detail-id">${escapeHtml(c.id)} · ${escapeHtml(moduleName(c.module))}</div>
      <h2>${escapeHtml(c.title)}</h2>
      <div class="detail-badges">
        <span class="badge">${escapeHtml(c.category)}</span>
        <span class="badge badge--${escapeAttr(c.priority)}">${escapeHtml(c.priority)}</span>
        ${(c.environment || []).map((e) => `<span class="badge badge--env-${escapeAttr(e)}">${escapeHtml(e)}</span>`).join('')}
        <span class="badge">${escapeHtml(c.type)}</span>
        <span class="badge badge--${escapeAttr(c.automationStatus || 'not_automated')}">${escapeHtml((c.automationStatus || '—').replace('_', ' '))}</span>
        <span class="badge badge--${escapeAttr(c.status)}">${escapeHtml(c.status)}</span>
        <span class="badge badge--${escapeAttr(result)}">${escapeHtml(result.replace('_', ' '))}</span>
      </div>

      <div class="detail-section detail-section--edit">
        <h4>Test result</h4>
        <div class="result-buttons">${resultButtons}</div>
        <button type="button" class="btn btn--link" data-action="set-result" data-value="not_run">Reset to not run</button>
        <label for="detail-run-by">Run by</label>
        <input type="text" id="detail-run-by" value="${escapeAttr(savedRunBy)}" placeholder="Your name (optional)" />
        <label for="detail-result-notes">Notes</label>
        <textarea id="detail-result-notes" rows="2" placeholder="Optional notes, e.g. failure reason">${escapeHtml(exec.notes || '')}</textarea>
        ${lastRunLine}
        <div id="detail-result-status" class="save-status"></div>
      </div>

      ${section('Description', c.description ? `<p>${escapeHtml(c.description)}</p>` : '')}
      ${section('Preconditions', bareList(c.preconditions))}
      ${section('Steps', list(c.steps))}
      ${section('Test data', c.testData ? `<p>${escapeHtml(c.testData)}</p>` : '')}
      ${section('Expected result', c.expectedResult ? `<p>${escapeHtml(c.expectedResult)}</p>` : '')}
      ${section('Tags', c.tags && c.tags.length ? `<div class="chip-group">${c.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>` : '')}
      ${section('Requirement', c.requirement ? `<p>${escapeHtml(c.requirement)}</p>` : '')}
      ${section('Linked defect', c.linkedDefect ? `<p>${escapeHtml(c.linkedDefect)}</p>` : '')}

      <div class="detail-section detail-section--edit">
        <h4>Automation</h4>
        <label for="detail-automation-status">Automation status</label>
        <select id="detail-automation-status">${automationOptions}</select>
        <label for="detail-automation-ref">Automation ref (file:line)</label>
        <input type="text" id="detail-automation-ref" value="${escapeAttr(c.automationRef || '')}" placeholder="test-framework/tests/.../file.spec.ts:42" />
        <button type="button" class="btn btn--secondary" data-action="save-automation">Save automation info</button>
        <div id="detail-automation-status-msg" class="save-status"></div>
      </div>

      ${section('Owner', c.owner ? `<p>${escapeHtml(c.owner)}</p>` : '')}
      ${section('Dates', (c.createdAt || c.updatedAt) ? `<p>Created ${escapeHtml(c.createdAt || '—')} · Updated ${escapeHtml(c.updatedAt || '—')}</p>` : '')}
    `;
    el('detail-overlay').classList.remove('hidden');
  }

  async function saveTestCasePatch(id, patch, statusElId) {
    const c = state.allCases.find((x) => x.id === id);
    if (!c) return;
    const statusEl = statusElId ? el(statusElId) : null;
    if (statusEl) statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/test-case', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: state.currentSystem, module: c.module, category: c.category, id: c.id, patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      Object.assign(c, body.testCase);
      renderStats();
      renderFilters();
      renderTable(getFilteredCases());
      if (state.openDetailId === id) openDetail(id);
    } catch (err) {
      if (statusEl) statusEl.textContent = `Failed to save — is the app running via "node server.js"? (${err.message})`;
      console.error(err);
    }
  }

  async function saveDefectPatch(id, patch, statusElId) {
    const c = state.allCases.find((x) => x.id === id);
    if (!c) return;
    const statusEl = statusElId ? el(statusElId) : null;
    if (statusEl) statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/defect', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // c.severity is stored capitalized ("Critical", "Low", ...) but the server
        // validates this against a lowercase slug pattern and uses it as the literal
        // filename (critical.json, low.json, ...) — lowercase it for the request.
        body: JSON.stringify({ module: c.module, severity: (c.severity || '').toLowerCase(), id: c.id, patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      Object.assign(c, body.defect);
      renderStats();
      renderFilters();
      renderTable(getFilteredCases());
      if (state.openDetailId === id) openDetail(id);
    } catch (err) {
      if (statusEl) statusEl.textContent = `Failed to save — is the app running via "node server.js"? (${err.message})`;
      console.error(err);
    }
  }

  function closeDetail() {
    el('detail-overlay').classList.add('hidden');
    state.openDetailId = null;
  }

  function renderAll() {
    renderFilters();
    renderTable(getFilteredCases());
  }

  // --- Export ---

  function toExportRow(c) {
    if (isDefectsSystem()) return toDefectExportRow(c);

    const entityLabel = currentSystemDef().entityLabel || 'Module';
    return {
      ID: c.id,
      [entityLabel]: moduleName(c.module),
      Category: c.category,
      'Sub-Feature': c.subFeature || '',
      Title: c.title,
      Priority: c.priority,
      Environment: (c.environment || []).join(', '),
      Type: c.type,
      'Automation Status': c.automationStatus || '',
      Status: c.status,
      Result: getExecutionResult(c),
      'Run At': (c.execution && c.execution.runAt) || '',
      'Run By': (c.execution && c.execution.runBy) || '',
      'Result Notes': (c.execution && c.execution.notes) || '',
      Preconditions: (c.preconditions || []).join(' | '),
      Steps: (c.steps || []).map((s, i) => `${i + 1}. ${s}`).join(' | '),
      'Test Data': c.testData || '',
      'Expected Result': c.expectedResult || '',
      Tags: (c.tags || []).join(', '),
      Requirement: c.requirement || '',
      'Linked Defect': c.linkedDefect || '',
      Owner: c.owner || '',
      'Automation Ref': c.automationRef || '',
      'Created At': c.createdAt || '',
      'Updated At': c.updatedAt || '',
      Description: c.description || '',
    };
  }

  function toDefectExportRow(c) {
    return {
      ID: c.id,
      Module: moduleName(c.module),
      Severity: c.severity,
      Category: c.category || '',
      Title: c.title,
      Status: c.status,
      'Status Detail': c.statusRaw || '',
      Description: c.description || '',
      Requirement: c.requirement || '',
      Component: c.component || '',
      'Affected Files': (c.affectedFiles || []).join(' | '),
      Tags: (c.tags || []).join(', '),
      'Fix Evidence': c.fixEvidence || '',
      'First Detected': c.firstDetected || '',
      'Last Verified': c.lastVerified || '',
      'Runs Open': c.runsOpen !== undefined ? c.runsOpen : '',
      Verified: c.verified === undefined ? '' : (c.verified ? 'Yes' : 'No'),
      'Source File': c.sourceFile || '',
    };
  }

  // Widths align 1:1 with toExportRow's key order: ID, [entity], Category, Sub-Feature,
  // Title, Priority, Environment, Type, Automation Status, Status, Result, Run At, Run
  // By, Result Notes, Preconditions, Steps, Test Data, Expected Result, Tags,
  // Requirement, Linked Defect, Owner, Automation Ref, Created At, Updated At, Description.
  const EXPORT_COL_WIDTHS = [12, 22, 12, 20, 40, 8, 16, 10, 16, 12, 10, 12, 14, 30, 40, 60, 30, 40, 24, 20, 14, 10, 30, 12, 12, 40].map((wch) => ({ wch }));
  const DEFECT_EXPORT_COL_WIDTHS = [10, 20, 10, 18, 45, 12, 16, 60, 20, 20, 30, 24, 40, 14, 14, 10, 10, 45].map((wch) => ({ wch }));

  function dateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function exportXlsx() {
    const defectsMode = isDefectsSystem();
    const rows = sortCases(getFilteredCases());
    if (!rows.length) {
      alert('No records match the current filters — nothing to export.');
      return;
    }
    const colWidths = defectsMode ? DEFECT_EXPORT_COL_WIDTHS : EXPORT_COL_WIDTHS;
    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(rows.map(toExportRow));
    wsAll['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsAll, defectsMode ? 'All Defects' : 'All Test Cases');

    const splitOrder = defectsMode ? DEFECT_SEVERITY_ORDER : CATEGORY_ORDER;
    const splitKey = defectsMode ? 'severity' : 'category';
    splitOrder.forEach((val) => {
      const subRows = rows.filter((r) => r[splitKey] === val);
      if (!subRows.length) return;
      const ws = XLSX.utils.json_to_sheet(subRows.map(toExportRow));
      ws['!cols'] = colWidths;
      const sheetName = val.charAt(0).toUpperCase() + val.slice(1);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    });

    XLSX.writeFile(wb, `vibrantix-${defectsMode ? 'defects' : 'test-cases'}-${dateStamp()}.xlsx`);
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCsv() {
    const rows = sortCases(getFilteredCases()).map(toExportRow);
    if (!rows.length) {
      alert('No records match the current filters — nothing to export.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(headers.map((h) => csvEscape(r[h])).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibrantix-${isDefectsSystem() ? 'defects' : 'test-cases'}-${dateStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Utilities ---

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  // --- Wiring ---

  function wireEvents() {
    el('search').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderTable(getFilteredCases());
    });
    el('module-search').addEventListener('input', (e) => {
      state.moduleSearch = e.target.value;
      renderModuleList();
    });
    el('btn-reset-filters').addEventListener('click', () => {
      resetFilters();
      renderAll();
    });
    el('detail-close').addEventListener('click', closeDetail);
    el('detail-overlay').addEventListener('click', (e) => {
      if (e.target === el('detail-overlay')) closeDetail();
    });
    el('detail-content').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !state.openDetailId) return;
      const id = state.openDetailId;

      if (btn.dataset.action === 'set-result') {
        const runByInput = el('detail-run-by');
        const runBy = runByInput ? runByInput.value.trim() : '';
        if (runBy) localStorage.setItem(RUN_BY_STORAGE_KEY, runBy);
        const notesInput = el('detail-result-notes');
        const execution = { result: btn.dataset.value, notes: notesInput ? notesInput.value.trim() : '' };
        if (runBy) execution.runBy = runBy;
        saveTestCasePatch(id, { execution }, 'detail-result-status');
      }

      if (btn.dataset.action === 'save-automation') {
        const statusSel = el('detail-automation-status');
        const refInput = el('detail-automation-ref');
        const patch = {
          automationRef: refInput ? refInput.value.trim() : '',
          automationStatus: statusSel ? statusSel.value : '',
        };
        saveTestCasePatch(id, patch, 'detail-automation-status-msg');
      }

      if (btn.dataset.action === 'save-defect-status') {
        const statusSel = el('detail-defect-status');
        const noteInput = el('detail-defect-status-note');
        const patch = {
          status: statusSel ? statusSel.value : '',
          statusRaw: noteInput ? noteInput.value.trim() : '',
        };
        saveDefectPatch(id, patch, 'detail-defect-status-msg');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
    });
    window.addEventListener('popstate', () => {
      const slug = systemSlugFromUrl();
      if (slug && slug !== state.currentSystem) switchSystem(slug, { updateUrl: false });
    });
    el('btn-export-xlsx').addEventListener('click', exportXlsx);
    el('btn-export-csv').addEventListener('click', exportCsv);
  }

  async function init() {
    wireEvents();
    try {
      await loadSystemsIndex();
      renderSystemTabs();
      renderSystemLabels();
      renderTableHead();
      await loadData();
    } catch (err) {
      el('load-status').textContent = `Failed to load data: ${err.message}`;
      console.error(err);
    }
    renderStats();
    renderAll();
  }

  init();
})();
