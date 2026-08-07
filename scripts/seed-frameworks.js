// One-time scaffold script: creates data/frameworks/manifest.json and
// data/frameworks/<slug>/_meta.json for the curated starter set of compliance
// frameworks. Safe to re-run — it only ever writes _meta.json and manifest.json,
// never touches hand-authored category files.
//
// There is no single hardcoded framework catalog anywhere else in the platform
// (frameworks are DB-driven via vibrantix-backend's ComplianceFramework model) —
// this is a curated starter set of frameworks already treated as real/live
// elsewhere in the codebase, not the full catalog. Extend FRAMEWORKS as more
// frameworks go live.
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'
];

const FRAMEWORKS = [
  {
    slug: 'iso-27001', name: 'ISO/IEC 27001', version: '2022', family: 'ISO', frameworkType: 'standard',
    description: 'Information security management system standard — Annex A controls and Clauses 4-10.',
    testFocusAreas: [
      'Requirement CRUD & versioning (2013 vs 2022 Annex A control set)',
      'Requirement-to-UCL control mapping accuracy',
      'Cross-framework UCL coverage aggregation',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'soc-2-type-i', name: 'SOC 2 Type I', version: '2017', family: 'AICPA', frameworkType: 'standard',
    description: 'Trust Services Criteria — point-in-time design-of-controls report.',
    testFocusAreas: [
      'Trust Services Criteria requirement coverage (Security/Availability/Confidentiality/Processing Integrity/Privacy)',
      'Requirement-to-UCL control mapping accuracy',
      'Point-in-time (Type I) scope boundary correctness vs Type II',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'soc-2-type-ii', name: 'SOC 2 Type II', version: '2017', family: 'AICPA', frameworkType: 'standard',
    description: 'Trust Services Criteria — operating-effectiveness-over-a-period report.',
    testFocusAreas: [
      'Trust Services Criteria requirement coverage over the audit period',
      'Requirement-to-UCL control mapping accuracy',
      'Evidence sampling/observation period correctness',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'gdpr', name: 'GDPR', version: '2016/679', family: 'EU', frameworkType: 'regulation',
    description: 'EU General Data Protection Regulation — data subject rights and processing lawfulness.',
    testFocusAreas: [
      'Article/requirement CRUD & versioning',
      'Requirement-to-UCL control mapping accuracy',
      'Data subject rights (DSAR) requirement traceability',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'hipaa', name: 'HIPAA', version: '1996', family: 'US-Federal', frameworkType: 'regulation',
    description: 'US Health Insurance Portability and Accountability Act — Privacy and Security Rules.',
    testFocusAreas: [
      'Privacy Rule / Security Rule requirement coverage',
      'Requirement-to-UCL control mapping accuracy',
      'PHI-handling requirement traceability',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'pci-dss', name: 'PCI DSS', version: '4.0', family: 'PCI SSC', frameworkType: 'standard',
    description: 'Payment Card Industry Data Security Standard — 12 core requirements.',
    testFocusAreas: [
      'Requirement CRUD & versioning (v4.0 vs legacy v3.2.1)',
      'Requirement-to-UCL control mapping accuracy',
      'SAQ scope/applicability correctness',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'nist-csf', name: 'NIST Cybersecurity Framework', version: '2.0', family: 'NIST', frameworkType: 'framework',
    description: 'NIST CSF Functions (Govern/Identify/Protect/Detect/Respond/Recover) and Categories/Subcategories.',
    testFocusAreas: [
      'Function/Category/Subcategory hierarchy correctness',
      'Requirement-to-UCL control mapping accuracy',
      'v2.0 Govern function coverage (new vs v1.1)',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'cis-controls-v8', name: 'CIS Controls v8', version: '8.0', family: 'CIS', frameworkType: 'standard',
    description: 'Center for Internet Security Critical Security Controls, Implementation Groups 1-3.',
    testFocusAreas: [
      'Safeguard CRUD & Implementation Group (IG1/IG2/IG3) tagging',
      'Requirement-to-UCL control mapping accuracy',
      'Cross-framework UCL coverage aggregation',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
  {
    slug: 'sox', name: 'Sarbanes-Oxley Act (SOX)', version: '2002', family: 'US-Federal', frameworkType: 'regulation',
    description: 'US SOX Section 404 internal controls over financial reporting.',
    testFocusAreas: [
      'Section 404 requirement coverage',
      'Requirement-to-UCL control mapping accuracy',
      'ICFR (internal controls over financial reporting) traceability',
      'Framework activation/deactivation impact on dependent modules',
    ],
  },
];

const root = path.join(__dirname, '..', 'data');
const frameworksDir = path.join(root, 'frameworks');

for (const f of FRAMEWORKS) {
  const dir = path.join(frameworksDir, f.slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    slug: f.slug,
    name: f.name,
    version: f.version,
    frameworkType: f.frameworkType,
    family: f.family,
    description: f.description,
    testFocusAreas: f.testFocusAreas,
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: FRAMEWORKS.map(f => ({ slug: f.slug, name: f.name, version: f.version, frameworkType: f.frameworkType })),
};
fs.writeFileSync(path.join(frameworksDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${FRAMEWORKS.length} frameworks and data/frameworks/manifest.json`);
