// One-time scaffold script: creates data/integrations/manifest.json and
// data/integrations/<slug>/_meta.json for connectors. Safe to re-run — only
// ever writes _meta.json and manifest.json, never touches hand-authored
// category files.
//
// Source of truth: vibrantix-connector-service/scripts/seeds/data/connector_registry.json
// (27 connectors total). Scaffolded here: only the 2 with literal status
// "active" — okta and jira. The other 25 ("available"/"coming_soon") can be
// added the same way once they're promoted to active.
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'
];

const CONNECTORS = [
  {
    slug: 'okta', name: 'Okta', category: 'identity', authMethod: 'oauth2_pkce',
    capabilities: ['users', 'groups', 'policies', 'logs'],
    description: 'Identity provider connector — user/group/policy sync and auth log ingestion.',
  },
  {
    slug: 'jira', name: 'Jira', category: 'itsm', authMethod: 'oauth2',
    capabilities: ['issues', 'projects', 'workflows', 'change_management', 'incident_management', 'access_requests', 'audit_log'],
    description: 'ITSM connector — issue/project sync, change & incident management records, audit log ingestion.',
  },
];

const root = path.join(__dirname, '..', 'data');
const integrationsDir = path.join(root, 'integrations');

for (const c of CONNECTORS) {
  const dir = path.join(integrationsDir, c.slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    slug: c.slug,
    name: c.name,
    category: c.category,
    authMethod: c.authMethod,
    capabilities: c.capabilities,
    description: c.description,
    testFocusAreas: [
      'Connection setup / OAuth flow correctness',
      'Connection health check (testConnection) — valid vs invalid credentials',
      'Per-capability sync correctness (' + c.capabilities.join(', ') + ')',
      'Disconnect/revoke flow and credential cleanup',
      'Multi-tenant isolation of synced data',
    ],
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: CONNECTORS.map(c => ({ slug: c.slug, name: c.name, category: c.category })),
};
fs.writeFileSync(path.join(integrationsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${CONNECTORS.length} connectors and data/integrations/manifest.json`);
