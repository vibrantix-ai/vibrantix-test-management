// One-time scaffold script: creates data/logs/manifest.json and
// data/logs/<slug>/_meta.json — one log-source entity per existing module
// (logs are generated *by* each module, so this system mirrors the module
// registry 1:1; slugs match data/modules/<slug> exactly). Safe to re-run —
// only ever writes _meta.json and manifest.json, never touches hand-authored
// category files.
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'
];

// Mirrors the MODULES slug/name list in seed-modules.js — kept as a separate
// literal here (rather than importing) since seed-modules.js is a script, not
// a module, and this list should only ever change in lockstep with a deliberate
// edit to both files.
const LOG_SOURCES = [
  { slug: 'dashboard-overview', name: 'Dashboard Overview', logTypes: ['activity'] },
  { slug: 'evidence-management', name: 'Evidence Management', logTypes: ['audit', 'activity'] },
  { slug: 'policy-management', name: 'Policy Management', logTypes: ['audit', 'activity'] },
  { slug: 'risk-register', name: 'Risk Register & Risk Center', logTypes: ['audit', 'activity'] },
  { slug: 'audit-assurance', name: 'Audit Assurance', logTypes: ['audit', 'activity'] },
  { slug: 'vendor-management', name: 'Vendor Management', logTypes: ['audit', 'activity'] },
  { slug: 'trust-vault', name: 'Trust Vault', logTypes: ['audit', 'activity', 'security'] },
  { slug: 'grc-framework', name: 'GRC Framework', logTypes: ['audit', 'activity'] },
  { slug: 'smart-compliance', name: 'Smart Compliance', logTypes: ['activity'] },
  { slug: 'intelli-audit', name: 'Intelli Audit', logTypes: ['activity'] },
  { slug: 'cloud-posture', name: 'Cloud Posture', logTypes: ['activity', 'security'] },
  { slug: 'compliance-vault', name: 'Compliance Vault', logTypes: ['audit', 'activity'] },
  { slug: 'integrations', name: 'Integrations', logTypes: ['audit', 'security'] },
  { slug: 'notifications', name: 'Notifications', logTypes: ['activity'] },
  { slug: 'onboarding', name: 'Onboarding & Getting Started', logTypes: ['activity'] },
  { slug: 'organization-management', name: 'Organization Management', logTypes: ['audit', 'activity'] },
  { slug: 'billing-plans', name: 'Billing & Plans', logTypes: ['audit', 'activity'] },
  { slug: 'profile-settings', name: 'Profile Settings', logTypes: ['audit', 'activity'] },
  { slug: 'project-management', name: 'Project Management', logTypes: ['activity'] },
  { slug: 'tasks', name: 'Centralised Tasks', logTypes: ['activity'] },
  { slug: 'support', name: 'Support', logTypes: ['activity'] },
  { slug: 'vciso', name: 'vCISO Suite', logTypes: ['activity'] },
  { slug: 'ai-assistant', name: 'AI Assistant', logTypes: ['activity', 'security'] },
  { slug: 'ai-evidence', name: 'AI Evidence', logTypes: ['audit', 'activity'] },
  { slug: 'rbac-security', name: 'RBAC & Access Control', logTypes: ['security', 'audit'] },
  { slug: 'tenant-isolation', name: 'Multi-Tenant Isolation', logTypes: ['security'] },
  { slug: 'security-vulnerability', name: 'Security Vulnerability', logTypes: ['security'] },
  { slug: 'performance', name: 'Performance', logTypes: ['system'] },
  { slug: 'ui-ux', name: 'UI/UX Consistency', logTypes: ['activity'] },
  { slug: 'api-contract-e2e', name: 'API Contract & Cross-Service E2E', logTypes: ['system'] },
];

const root = path.join(__dirname, '..', 'data');
const logsDir = path.join(root, 'logs');

for (const l of LOG_SOURCES) {
  const dir = path.join(logsDir, l.slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    slug: l.slug,
    name: l.name,
    sourceModule: l.slug,
    logTypes: l.logTypes,
    description: `Logs emitted by the ${l.name} module (${l.logTypes.join(', ')}).`,
    testFocusAreas: [
      'Log entry generated on every relevant state change (create/update/delete/access)',
      'Log entry field completeness (actor, timestamp, org/tenant scope, action, target)',
      'Log immutability / tamper-evidence',
      'Multi-tenant isolation of log entries',
    ],
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: LOG_SOURCES.map(l => ({ slug: l.slug, name: l.name, logTypes: l.logTypes })),
};
fs.writeFileSync(path.join(logsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${LOG_SOURCES.length} log sources and data/logs/manifest.json`);
