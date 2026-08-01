// Zero-dependency static file server + a small write API. The app fetches local
// JSON files (blocked under file:// by CORS) and, for marking test results /
// correcting automation status, PUTs a patch back to the source JSON file on disk.
// Usage: node server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 4500;
const ROOT = __dirname;
const DATA_MODULES_ROOT = path.join(ROOT, 'data', 'modules');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// Only these fields may be written back from the viewer — everything else about
// a test case is authored content and should only change via editing the JSON directly.
const PATCHABLE_FIELDS = ['execution', 'automationStatus', 'automationRef'];
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const VALID_EXECUTION_RESULTS = ['not_run', 'pass', 'fail', 'blocked', 'skipped'];
const VALID_AUTOMATION_STATUSES = ['automated', 'not_automated', 'planned', 'flaky'];

function sendJson(res, statusCode, body) {
  const data = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function todayDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function handleUpdateTestCase(req, res) {
  let body;
  try {
    body = JSON.parse(await readRequestBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { module: moduleSlug, category, id, patch } = body || {};
  if (!moduleSlug || !category || !id || !patch || typeof patch !== 'object') {
    return sendJson(res, 400, { error: 'Body must include module, category, id, and patch' });
  }
  if (!SLUG_PATTERN.test(moduleSlug) || !SLUG_PATTERN.test(category)) {
    return sendJson(res, 400, { error: 'Invalid module or category' });
  }

  const patchKeys = Object.keys(patch);
  const invalidKey = patchKeys.find((k) => !PATCHABLE_FIELDS.includes(k));
  if (invalidKey) {
    return sendJson(res, 400, { error: `Field "${invalidKey}" cannot be updated from the viewer` });
  }
  if (patch.execution !== undefined) {
    if (typeof patch.execution !== 'object' || patch.execution === null) {
      return sendJson(res, 400, { error: 'execution must be an object' });
    }
    if (patch.execution.result !== undefined && !VALID_EXECUTION_RESULTS.includes(patch.execution.result)) {
      return sendJson(res, 400, { error: `execution.result must be one of: ${VALID_EXECUTION_RESULTS.join(', ')}` });
    }
  }
  // Empty string means "clear this field" (it's not a valid enum value, so it can't mean
  // anything else) — deleted from the case object below rather than stored as "".
  if (patch.automationStatus !== undefined && patch.automationStatus !== '' && !VALID_AUTOMATION_STATUSES.includes(patch.automationStatus)) {
    return sendJson(res, 400, { error: `automationStatus must be one of: ${VALID_AUTOMATION_STATUSES.join(', ')}` });
  }

  const filePath = path.join(DATA_MODULES_ROOT, moduleSlug, `${category}.json`);
  if (!filePath.startsWith(DATA_MODULES_ROOT)) {
    return sendJson(res, 400, { error: 'Invalid path' });
  }

  let cases;
  try {
    cases = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return sendJson(res, 404, { error: `Could not read ${moduleSlug}/${category}.json: ${e.message}` });
  }

  const index = cases.findIndex((c) => c.id === id);
  if (index === -1) {
    return sendJson(res, 404, { error: `Test case ${id} not found in ${moduleSlug}/${category}.json` });
  }

  const updated = { ...cases[index], ...patch, updatedAt: todayDate() };
  if (patch.automationStatus === '') delete updated.automationStatus;
  if (patch.automationRef === '') delete updated.automationRef;
  cases[index] = updated;

  try {
    fs.writeFileSync(filePath, JSON.stringify(cases, null, 2) + '\n');
  } catch (e) {
    return sendJson(res, 500, { error: `Failed to write ${moduleSlug}/${category}.json: ${e.message}` });
  }

  sendJson(res, 200, { ok: true, testCase: updated });
}

const server = http.createServer((req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'PUT' && reqPath === '/api/test-case') {
    handleUpdateTestCase(req, res).catch((e) => sendJson(res, 500, { error: e.message }));
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  // Redirect (not rewrite) so the browser's address bar — and therefore the
  // base URL used to resolve the page's relative <link>/<script> paths —
  // actually lands under /app/. Silently serving app/index.html's bytes at "/"
  // would break every relative asset reference on the page.
  if (reqPath === '/') {
    res.writeHead(302, { Location: '/app/' });
    res.end();
    return;
  }
  let filePath = reqPath;
  if (filePath === '/app' || filePath === '/app/') filePath = '/app/index.html';

  const resolved = path.normalize(path.join(ROOT, filePath));
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(resolved);
    // This tool is edited and reloaded constantly during use — never let the browser
    // serve a stale cached copy of app.js/styles.css/data files behind our backs.
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Vibrantix Test Management System running at http://localhost:${PORT}`);
});
