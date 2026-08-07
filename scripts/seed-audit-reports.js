// One-time scaffold script: creates data/audit-reports/manifest.json and
// data/audit-reports/<slug>/_meta.json — one entity per framework's generated
// audit report, reusing the same slugs as data/frameworks/ (the system
// directory already disambiguates, so no suffix is needed). Safe to re-run —
// only ever writes _meta.json and manifest.json, never touches hand-authored
// category files.
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'
];

// Mirrors the FRAMEWORKS slug/name list in seed-frameworks.js — kept as a
// separate literal here since seed-frameworks.js is a script, not a module,
// and this list should only ever change in lockstep with a deliberate edit
// to both files.
const AUDIT_REPORTS = [
  { slug: 'iso-27001', name: 'ISO/IEC 27001 Audit Report', framework: 'iso-27001' },
  { slug: 'soc-2-type-i', name: 'SOC 2 Type I Audit Report', framework: 'soc-2-type-i' },
  { slug: 'soc-2-type-ii', name: 'SOC 2 Type II Audit Report', framework: 'soc-2-type-ii' },
  { slug: 'gdpr', name: 'GDPR Compliance Audit Report', framework: 'gdpr' },
  { slug: 'hipaa', name: 'HIPAA Compliance Audit Report', framework: 'hipaa' },
  { slug: 'pci-dss', name: 'PCI DSS Audit Report', framework: 'pci-dss' },
  { slug: 'nist-csf', name: 'NIST CSF Assessment Report', framework: 'nist-csf' },
  { slug: 'cis-controls-v8', name: 'CIS Controls v8 Assessment Report', framework: 'cis-controls-v8' },
  { slug: 'sox', name: 'SOX Section 404 Audit Report', framework: 'sox' },
];

const root = path.join(__dirname, '..', 'data');
const auditReportsDir = path.join(root, 'audit-reports');

for (const r of AUDIT_REPORTS) {
  const dir = path.join(auditReportsDir, r.slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    slug: r.slug,
    name: r.name,
    framework: r.framework,
    description: `Generated audit report fields and structure for the ${r.framework} framework (see audit-report-generator-service).`,
    testFocusAreas: [
      'Report field completeness (scope, period, findings, evidence references, sign-off)',
      'Report field accuracy against underlying audit-assurance data',
      'Report generation triggers correct data snapshot (no stale/mismatched framework version)',
      'Export format fidelity (PDF/data correctness)',
    ],
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: AUDIT_REPORTS.map(r => ({ slug: r.slug, name: r.name, framework: r.framework })),
};
fs.writeFileSync(path.join(auditReportsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${AUDIT_REPORTS.length} audit reports and data/audit-reports/manifest.json`);
