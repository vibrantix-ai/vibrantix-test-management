// Validates data/<system>/**/*.json against the schema conventions in SCHEMA.md, across all
// systems listed in data/manifest.json (Modules, Frameworks, Logs, Audit Reports, Integrations,
// AI Defects Management). Usage: node scripts/validate-data.js
// Exits non-zero and prints every problem found if anything is wrong.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');

const TEST_CASE_CATEGORIES = ['unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'];
const TEST_CASE_REQUIRED_FIELDS = ['id', 'module', 'category', 'title', 'priority', 'type', 'steps', 'expectedResult', 'status'];
const TEST_CASE_ENUMS = {
  category: TEST_CASE_CATEGORIES,
  priority: ['P0', 'P1', 'P2', 'P3'],
  type: ['manual', 'automated', 'both'],
  automationStatus: ['automated', 'not_automated', 'planned', 'flaky'],
  status: ['active', 'draft', 'deprecated'],
};
const TEST_CASE_ID_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+-[0-9]{3}$/;
const VALID_EXECUTION_RESULTS = ['not_run', 'pass', 'fail', 'blocked', 'skipped'];

const DEFECT_CATEGORIES = ['critical', 'high', 'medium', 'low'];
const DEFECT_REQUIRED_FIELDS = ['id', 'module', 'title', 'severity', 'status', 'sourceFile'];
const DEFECT_ENUMS = {
  severity: ['Critical', 'High', 'Medium', 'Low'],
  status: ['open', 'fixed', 'regressed', 'in_progress', 'new', 'wont_fix', 'cannot_verify'],
};

const errors = [];

function validateEntity(system, dir, entitySlugs, categories, requiredFields, enums, idPattern, categoryField) {
  const systemRoot = path.join(ROOT, system.dataDir);
  const entPath = path.join(systemRoot, dir);
  const seenIds = new Map();
  if (!entitySlugs.has(dir)) errors.push(`[${system.slug}/${dir}] entity folder is not listed in data/${system.dataDir}/manifest.json`);

  const metaPath = path.join(entPath, '_meta.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`[${system.slug}/${dir}] missing _meta.json`);
  } else {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.slug !== dir) errors.push(`[${system.slug}/${dir}] _meta.json slug "${meta.slug}" does not match folder name`);
  }

  const files = fs.readdirSync(entPath).filter((f) => f.endsWith('.json') && f !== '_meta.json');
  let total = 0;
  for (const file of files) {
    const category = file.replace(/\.json$/, '');
    if (!categories.includes(category)) {
      errors.push(`[${system.slug}/${dir}/${file}] filename is not a recognised category for this system`);
      continue;
    }
    let records;
    try {
      records = JSON.parse(fs.readFileSync(path.join(entPath, file), 'utf8'));
    } catch (e) {
      errors.push(`[${system.slug}/${dir}/${file}] invalid JSON: ${e.message}`);
      continue;
    }
    if (!Array.isArray(records)) {
      errors.push(`[${system.slug}/${dir}/${file}] must be a JSON array`);
      continue;
    }
    records.forEach((r, idx) => {
      total++;
      const loc = `[${system.slug}/${dir}/${file}#${idx}]`;
      for (const field of requiredFields) {
        if (r[field] === undefined || r[field] === null || r[field] === '') errors.push(`${loc} missing required field "${field}"`);
      }
      if (r.id) {
        if (idPattern && !idPattern.test(r.id)) errors.push(`${loc} id "${r.id}" does not match <PREFIX>-<CATEGORY>-<NNN> pattern`);
        if (seenIds.has(r.id)) errors.push(`${loc} duplicate id "${r.id}" (also in ${seenIds.get(r.id)})`);
        else seenIds.set(r.id, `${system.slug}/${dir}/${file}`);
      }
      if (r.module !== dir) errors.push(`${loc} module field "${r.module}" does not match folder "${dir}"`);
      if (categoryField && String(r[categoryField] || '').toLowerCase() !== category) {
        errors.push(`${loc} ${categoryField} field "${r[categoryField]}" does not match filename "${category}"`);
      }
      for (const [field, allowed] of Object.entries(enums)) {
        if (r[field] !== undefined && !allowed.includes(r[field])) {
          errors.push(`${loc} field "${field}" has invalid value "${r[field]}" (allowed: ${allowed.join(', ')})`);
        }
      }
      if (Array.isArray(r.steps) && r.steps.length === 0) errors.push(`${loc} steps array is empty`);
      if (r.execution !== undefined) {
        if (r.execution.result !== undefined && !VALID_EXECUTION_RESULTS.includes(r.execution.result)) {
          errors.push(`${loc} execution.result has invalid value "${r.execution.result}" (allowed: ${VALID_EXECUTION_RESULTS.join(', ')})`);
        }
      }
    });
  }
  return total;
}

const topManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const systems = topManifest.systems || [];

let grandTotal = 0;
let entityFolderCount = 0;
const perSystemSummary = [];

for (const system of systems) {
  const systemRoot = path.join(ROOT, system.dataDir);
  if (!fs.existsSync(systemRoot)) {
    errors.push(`[${system.slug}] dataDir "${system.dataDir}" listed in data/manifest.json does not exist`);
    continue;
  }
  const systemManifestPath = path.join(systemRoot, 'manifest.json');
  if (!fs.existsSync(systemManifestPath)) {
    errors.push(`[${system.slug}] missing data/${system.dataDir}/manifest.json`);
    continue;
  }
  const systemManifest = JSON.parse(fs.readFileSync(systemManifestPath, 'utf8'));
  const entitySlugs = new Set((systemManifest.entities || []).map((e) => e.slug));

  const isDefects = system.recordKind === 'defect';
  const categories = isDefects ? DEFECT_CATEGORIES : (systemManifest.categories && systemManifest.categories.length ? systemManifest.categories : TEST_CASE_CATEGORIES);
  const requiredFields = isDefects ? DEFECT_REQUIRED_FIELDS : TEST_CASE_REQUIRED_FIELDS;
  const enums = isDefects ? DEFECT_ENUMS : TEST_CASE_ENUMS;
  const idPattern = isDefects ? null : TEST_CASE_ID_PATTERN;
  const categoryField = isDefects ? 'severity' : 'category';

  const entityDirs = fs.readdirSync(systemRoot).filter((d) =>
    fs.statSync(path.join(systemRoot, d)).isDirectory()
  );

  let systemTotal = 0;
  for (const dir of entityDirs) {
    systemTotal += validateEntity(system, dir, entitySlugs, categories, requiredFields, enums, idPattern, categoryField);
    entityFolderCount++;
  }
  grandTotal += systemTotal;
  perSystemSummary.push(`${system.slug}: ${systemTotal} record(s) across ${entityDirs.length} entit${entityDirs.length === 1 ? 'y' : 'ies'}`);
}

if (errors.length) {
  console.error(`Found ${errors.length} problem(s):\n`);
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log(`OK — validated ${grandTotal} record(s) across ${systems.length} system(s), ${entityFolderCount} entity folders, no problems found.`);
  perSystemSummary.forEach((s) => console.log(`  - ${s}`));
}
