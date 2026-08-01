(function () {
  'use strict';

  const DATA_ROOT = '../data';
  const CATEGORY_ORDER = ['unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'];
  const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'];
  const TYPE_ORDER = ['manual', 'automated', 'both'];
  const AUTOMATION_ORDER = ['automated', 'not_automated', 'planned', 'flaky'];
  const STATUS_ORDER = ['active', 'draft', 'deprecated'];
  const DEFAULT_ACTIVE_STATUSES = ['active', 'draft'];
  const MAX_TAG_CHIPS = 60;

  const state = {
    allCases: [],
    moduleMeta: {}, // slug -> meta
    active: {
      category: new Set(),
      priority: new Set(),
      type: new Set(),
      automation: new Set(),
      status: new Set(DEFAULT_ACTIVE_STATUSES),
      tag: new Set(),
      module: new Set(),
    },
    search: '',
    moduleSearch: '',
    sort: { key: 'id', dir: 'asc' },
  };

  const el = (id) => document.getElementById(id);

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }

  async function loadData() {
    el('load-status').textContent = 'Loading...';
    const manifest = await fetchJson(`${DATA_ROOT}/manifest.json`);
    const categories = manifest.categories && manifest.categories.length ? manifest.categories : CATEGORY_ORDER;

    const perModule = await Promise.all(
      manifest.modules.map(async (m) => {
        let meta = { slug: m.slug, name: m.name, scope: m.scope };
        try {
          meta = await fetchJson(`${DATA_ROOT}/modules/${m.slug}/_meta.json`);
        } catch (e) {
          console.warn('No _meta.json for module', m.slug);
        }
        state.moduleMeta[m.slug] = meta;

        const results = await Promise.allSettled(
          categories.map((cat) => fetchJson(`${DATA_ROOT}/modules/${m.slug}/${cat}.json`))
        );
        const cases = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) cases.push(...r.value);
        });
        return cases;
      })
    );

    state.allCases = perModule.flat();
    el('load-status').textContent = `Loaded ${state.allCases.length} test cases across ${manifest.modules.length} modules`;
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

  function countByModule(cases) {
    const counts = {};
    cases.forEach((c) => (counts[c.module] = (counts[c.module] || 0) + 1));
    return counts;
  }

  function renderStats() {
    const total = state.allCases.length;
    const active = state.allCases.filter((c) => c.status !== 'deprecated').length;
    const catCounts = countBy(state.allCases, 'category');
    const p0 = countBy(state.allCases, 'priority').P0 || 0;
    const automated = countBy(state.allCases, 'automationStatus').automated || 0;

    const tiles = [
      { label: 'Total test cases', value: total },
      { label: 'Active', value: active },
      { label: 'P0 (blocking)', value: p0 },
      { label: 'Automated', value: automated },
      ...CATEGORY_ORDER.filter((c) => catCounts[c]).map((c) => ({ label: c, value: catCounts[c] })),
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
    const modules = Object.values(state.moduleMeta)
      .filter((m) => counts[m.slug])
      .filter((m) => !search || m.name.toLowerCase().includes(search) || m.slug.includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = modules
      .map((m) => {
        const active = state.active.module.has(m.slug);
        return `<div class="module-item${active ? ' active' : ''}" data-slug="${escapeAttr(m.slug)}">
          <span>${escapeHtml(m.name)}</span><span class="count">${counts[m.slug]}</span>
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

  function renderFilters() {
    chipGroup('filter-category', 'category', CATEGORY_ORDER, countBy(state.allCases, 'category'));
    chipGroup('filter-priority', 'priority', PRIORITY_ORDER, countBy(state.allCases, 'priority'));
    chipGroup('filter-type', 'type', TYPE_ORDER, countBy(state.allCases, 'type'));
    chipGroup('filter-automation', 'automation', AUTOMATION_ORDER, countBy(state.allCases, 'automationStatus'), (v) => v.replace('_', ' '));
    chipGroup('filter-status', 'status', STATUS_ORDER, countBy(state.allCases, 'status'));

    const tagCounts = countByTag(state.allCases);
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TAG_CHIPS)
      .map(([t]) => t);
    chipGroup('filter-tag', 'tag', topTags, tagCounts, null, true);

    renderModuleList();
  }

  function getFilteredCases() {
    const search = state.search.trim().toLowerCase();
    return state.allCases.filter((c) => {
      if (state.active.category.size && !state.active.category.has(c.category)) return false;
      if (state.active.priority.size && !state.active.priority.has(c.priority)) return false;
      if (state.active.type.size && !state.active.type.has(c.type)) return false;
      if (state.active.automation.size && !state.active.automation.has(c.automationStatus)) return false;
      if (state.active.status.size && !state.active.status.has(c.status)) return false;
      if (state.active.module.size && !state.active.module.has(c.module)) return false;
      if (state.active.tag.size && !(c.tags || []).some((t) => state.active.tag.has(t))) return false;
      if (search) {
        const haystack = [
          c.id, c.title, c.description, c.subFeature, c.testData, c.expectedResult,
          ...(c.tags || []), ...(c.preconditions || []), ...(c.steps || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function sortCases(cases) {
    const { key, dir } = state.sort;
    const sorted = [...cases].sort((a, b) => {
      const av = (a[key] ?? '').toString();
      const bv = (b[key] ?? '').toString();
      return av.localeCompare(bv, undefined, { numeric: true });
    });
    if (dir === 'desc') sorted.reverse();
    return sorted;
  }

  function moduleName(slug) {
    return state.moduleMeta[slug] ? state.moduleMeta[slug].name : slug;
  }

  function renderTable(filtered) {
    const rows = sortCases(filtered);
    el('result-count').textContent = `Showing ${rows.length} of ${state.allCases.length} test cases`;

    if (!rows.length) {
      el('table-body').innerHTML = `<tr class="empty-row"><td colspan="9">No test cases match the current filters.</td></tr>`;
      return;
    }

    el('table-body').innerHTML = rows
      .map(
        (c) => `<tr data-id="${escapeAttr(c.id)}">
          <td>${escapeHtml(c.id)}</td>
          <td>${escapeHtml(moduleName(c.module))}</td>
          <td><span class="cat-tag">${escapeHtml(c.category)}</span></td>
          <td>${escapeHtml(c.subFeature || '—')}</td>
          <td>${escapeHtml(c.title)}</td>
          <td><span class="badge badge--${escapeAttr(c.priority)}">${escapeHtml(c.priority)}</span></td>
          <td>${escapeHtml(c.type)}</td>
          <td><span class="badge badge--${escapeAttr(c.automationStatus || 'not_automated')}">${escapeHtml((c.automationStatus || '—').replace('_', ' '))}</span></td>
          <td><span class="badge badge--${escapeAttr(c.status)}">${escapeHtml(c.status)}</span></td>
        </tr>`
      )
      .join('');

    el('table-body').querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => openDetail(tr.dataset.id));
    });
  }

  function openDetail(id) {
    const c = state.allCases.find((x) => x.id === id);
    if (!c) return;
    const section = (title, body) => (body ? `<div class="detail-section"><h4>${title}</h4>${body}</div>` : '');
    const list = (items) => (items && items.length ? `<ol>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : '');
    const bareList = (items) => (items && items.length ? `<ul>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '');

    el('detail-content').innerHTML = `
      <div class="detail-id">${escapeHtml(c.id)} · ${escapeHtml(moduleName(c.module))}</div>
      <h2>${escapeHtml(c.title)}</h2>
      <div class="detail-badges">
        <span class="badge">${escapeHtml(c.category)}</span>
        <span class="badge badge--${escapeAttr(c.priority)}">${escapeHtml(c.priority)}</span>
        <span class="badge">${escapeHtml(c.type)}</span>
        <span class="badge badge--${escapeAttr(c.automationStatus || 'not_automated')}">${escapeHtml((c.automationStatus || '—').replace('_', ' '))}</span>
        <span class="badge badge--${escapeAttr(c.status)}">${escapeHtml(c.status)}</span>
      </div>
      ${section('Description', c.description ? `<p>${escapeHtml(c.description)}</p>` : '')}
      ${section('Preconditions', bareList(c.preconditions))}
      ${section('Steps', list(c.steps))}
      ${section('Test data', c.testData ? `<p>${escapeHtml(c.testData)}</p>` : '')}
      ${section('Expected result', c.expectedResult ? `<p>${escapeHtml(c.expectedResult)}</p>` : '')}
      ${section('Tags', c.tags && c.tags.length ? `<div class="chip-group">${c.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>` : '')}
      ${section('Requirement', c.requirement ? `<p>${escapeHtml(c.requirement)}</p>` : '')}
      ${section('Linked defect', c.linkedDefect ? `<p>${escapeHtml(c.linkedDefect)}</p>` : '')}
      ${section('Automation ref', c.automationRef ? `<p>${escapeHtml(c.automationRef)}</p>` : '')}
      ${section('Owner', c.owner ? `<p>${escapeHtml(c.owner)}</p>` : '')}
      ${section('Dates', (c.createdAt || c.updatedAt) ? `<p>Created ${escapeHtml(c.createdAt || '—')} · Updated ${escapeHtml(c.updatedAt || '—')}</p>` : '')}
    `;
    el('detail-overlay').classList.remove('hidden');
  }

  function closeDetail() {
    el('detail-overlay').classList.add('hidden');
  }

  function renderAll() {
    renderFilters();
    renderTable(getFilteredCases());
  }

  // --- Export ---

  function toExportRow(c) {
    return {
      ID: c.id,
      Module: moduleName(c.module),
      Category: c.category,
      'Sub-Feature': c.subFeature || '',
      Title: c.title,
      Priority: c.priority,
      Type: c.type,
      'Automation Status': c.automationStatus || '',
      Status: c.status,
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

  const EXPORT_COL_WIDTHS = [12, 22, 12, 20, 40, 8, 10, 16, 12, 40, 60, 30, 40, 24, 20, 14, 10, 30, 12, 12, 40].map((wch) => ({ wch }));

  function dateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function exportXlsx() {
    const rows = sortCases(getFilteredCases());
    if (!rows.length) {
      alert('No test cases match the current filters — nothing to export.');
      return;
    }
    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(rows.map(toExportRow));
    wsAll['!cols'] = EXPORT_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Test Cases');

    CATEGORY_ORDER.forEach((cat) => {
      const catRows = rows.filter((r) => r.category === cat);
      if (!catRows.length) return;
      const ws = XLSX.utils.json_to_sheet(catRows.map(toExportRow));
      ws['!cols'] = EXPORT_COL_WIDTHS;
      const sheetName = cat.charAt(0).toUpperCase() + cat.slice(1);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    });

    XLSX.writeFile(wb, `vibrantix-test-cases-${dateStamp()}.xlsx`);
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCsv() {
    const rows = sortCases(getFilteredCases()).map(toExportRow);
    if (!rows.length) {
      alert('No test cases match the current filters — nothing to export.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(headers.map((h) => csvEscape(r[h])).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibrantix-test-cases-${dateStamp()}.csv`;
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
      state.active = {
        category: new Set(), priority: new Set(), type: new Set(), automation: new Set(),
        status: new Set(DEFAULT_ACTIVE_STATUSES), tag: new Set(), module: new Set(),
      };
      state.search = '';
      state.moduleSearch = '';
      el('search').value = '';
      el('module-search').value = '';
      renderAll();
    });
    document.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.sort = { key, dir: 'asc' };
        renderTable(getFilteredCases());
      });
    });
    el('detail-close').addEventListener('click', closeDetail);
    el('detail-overlay').addEventListener('click', (e) => {
      if (e.target === el('detail-overlay')) closeDetail();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
    });
    el('btn-export-xlsx').addEventListener('click', exportXlsx);
    el('btn-export-csv').addEventListener('click', exportCsv);
  }

  async function init() {
    wireEvents();
    try {
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
