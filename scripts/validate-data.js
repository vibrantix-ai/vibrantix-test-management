// Validates data/modules/**/*.json against the schema conventions in SCHEMA.md.
// Usage: node scripts/validate-data.js
// Exits non-zero and prints every problem found if anything is wrong.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const REQUIRED_FIELDS = ['id', 'module', 'category', 'title', 'priority', 'type', 'steps', 'expectedResult', 'status'];
const ENUMS = {
  category: ['unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'],
  priority: ['P0', 'P1', 'P2', 'P3'],
  type: ['manual', 'automated', 'both'],
  automationStatus: ['automated', 'not_automated', 'planned', 'flaky'],
  status: ['active', 'draft', 'deprecated'],
};
const ID_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+-[0-9]{3}$/;

const errors = [];
const seenIds = new Map();

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const manifestSlugs = new Set(manifest.modules.map((m) => m.slug));

const moduleDirs = fs.readdirSync(path.join(ROOT, 'modules')).filter((d) =>
  fs.statSync(path.join(ROOT, 'modules', d)).isDirectory()
);

for (const dir of moduleDirs) {
  const modPath = path.join(ROOT, 'modules', dir);
  if (!manifestSlugs.has(dir)) errors.push(`[${dir}] module folder is not listed in manifest.json`);

  const metaPath = path.join(modPath, '_meta.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`[${dir}] missing _meta.json`);
  } else {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.slug !== dir) errors.push(`[${dir}] _meta.json slug "${meta.slug}" does not match folder name`);
  }

  const files = fs.readdirSync(modPath).filter((f) => f.endsWith('.json') && f !== '_meta.json');
  for (const file of files) {
    const category = file.replace(/\.json$/, '');
    if (!ENUMS.category.includes(category)) {
      errors.push(`[${dir}/${file}] filename is not a recognised category`);
      continue;
    }
    let cases;
    try {
      cases = JSON.parse(fs.readFileSync(path.join(modPath, file), 'utf8'));
    } catch (e) {
      errors.push(`[${dir}/${file}] invalid JSON: ${e.message}`);
      continue;
    }
    if (!Array.isArray(cases)) {
      errors.push(`[${dir}/${file}] must be a JSON array`);
      continue;
    }
    cases.forEach((c, idx) => {
      const loc = `[${dir}/${file}#${idx}]`;
      for (const field of REQUIRED_FIELDS) {
        if (c[field] === undefined || c[field] === null || c[field] === '') errors.push(`${loc} missing required field "${field}"`);
      }
      if (c.id && !ID_PATTERN.test(c.id)) errors.push(`${loc} id "${c.id}" does not match <PREFIX>-<CATEGORY>-<NNN> pattern`);
      if (c.id) {
        if (seenIds.has(c.id)) errors.push(`${loc} duplicate id "${c.id}" (also in ${seenIds.get(c.id)})`);
        else seenIds.set(c.id, `${dir}/${file}`);
      }
      if (c.module !== dir) errors.push(`${loc} module field "${c.module}" does not match folder "${dir}"`);
      if (c.category !== category) errors.push(`${loc} category field "${c.category}" does not match filename "${category}"`);
      for (const [field, allowed] of Object.entries(ENUMS)) {
        if (c[field] !== undefined && !allowed.includes(c[field])) {
          errors.push(`${loc} field "${field}" has invalid value "${c[field]}" (allowed: ${allowed.join(', ')})`);
        }
      }
      if (Array.isArray(c.steps) && c.steps.length === 0) errors.push(`${loc} steps array is empty`);
    });
  }
}

if (errors.length) {
  console.error(`Found ${errors.length} problem(s):\n`);
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log(`OK — validated ${seenIds.size} test cases across ${moduleDirs.length} module folders, no problems found.`);
}
