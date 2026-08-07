// One-time scaffold script: creates data/defects/manifest.json and
// data/defects/<slug>/_meta.json for the 13 modules with real defect data
// converted from QA_Tracker/. Safe to re-run — only ever writes _meta.json and
// manifest.json, never touches the hand/agent-authored critical.json /
// high.json / medium.json / low.json content files.
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['critical', 'high', 'medium', 'low'];

const MODULES = [
  { slug: 'evidence-management', name: 'Evidence Management', scope: 'feature', qaAgent: 'Evidence_Management_QA_Agent', sourceTrackers: ['QA_Tracker/EVIDENCE_MANAGEMENT_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Evidence Management live defect registry.' },
  { slug: 'grc-framework', name: 'GRC Framework', scope: 'feature', qaAgent: 'GRC_Framework_QA_Agent', sourceTrackers: ['QA_Tracker/GRC_FRAMEWORK_QA_LIVE_TRACKER.md'], description: 'Defects converted from the GRC Framework live defect registry.' },
  { slug: 'policy-management', name: 'Policy Management', scope: 'feature', qaAgent: 'Policy_Management_QA_Agent', sourceTrackers: ['QA_Tracker/POLICY_MANAGEMENT_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Policy Management live defect registry.' },
  { slug: 'trust-vault', name: 'Trust Vault', scope: 'feature', qaAgent: 'Trust_Vault_QA_Agent', sourceTrackers: ['QA_Tracker/TRUST_VAULT_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Trust Vault live defect registry.' },
  { slug: 'vendor-management', name: 'Vendor Management', scope: 'feature', qaAgent: 'Vendor_Management_QA_Agent', sourceTrackers: ['QA_Tracker/VENDOR_MANAGEMENT_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Vendor Management live defect registry.' },
  { slug: 'notifications', name: 'Notifications', scope: 'platform', qaAgent: 'Notifications_QA_Agent', sourceTrackers: ['QA_Tracker/NOTIFICATIONS_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Notifications live defect registry.' },
  { slug: 'tasks', name: 'Centralised Tasks', scope: 'feature', qaAgent: 'Tasks_QA_Agent', sourceTrackers: ['QA_Tracker/TASKS_QA_LIVE_TRACKER.md'], description: 'Defects converted from the Centralised Tasks live defect registry.' },
  { slug: 'audit-assurance', name: 'Audit Assurance', scope: 'feature', qaAgent: 'Audit_Assurance_QA_Agent', sourceTrackers: ['QA_Tracker/AUDIT_ASSURANCE_QA_LIVE_TRACKER.md'], description: "Defects converted from the Audit Assurance live defect registry. Source IDs use mixed prefixes (CD-/D-/H-/M-) segmented by severity rather than one module prefix — all assigned module='audit-assurance', original IDs preserved as-is." },
  { slug: 'risk-register', name: 'Risk Register & Risk Center', scope: 'feature', qaAgent: 'Risk_Register_QA_Agent', sourceTrackers: ['QA_Tracker/RISK_REGISTER_QA_LIVE_TRACKER.md'], description: "Defects converted from the Risk Register live defect registry. Source uses an alternate column schema (Priority/Component/ISO Ref/Affected Files, no Sev/Runs-Open/Fix-Evidence columns)." },
  { slug: 'security-vulnerability', name: 'Security Vulnerability', scope: 'platform', qaAgent: 'Security_Vulnerability_QA_Agent', sourceTrackers: ['QA_Tracker/SECURITY_VULNERABILITY_QA_LIVE_TRACKER.md'], description: "Defects converted from the Security Vulnerability live defect registry. Source uses an alternate column schema (CWE/OWASP/Affected Area instead of Category); CWE/OWASP folded into tags." },
  { slug: 'rbac-security', name: 'RBAC & Access Control', scope: 'platform', qaAgent: 'RBAC_Security_QA_Agent', sourceTrackers: ['QA_Tracker/RBAC/RBAC_SECURITY_QA_LIVE_TRACKER.md'], description: 'Defects converted from the RBAC/Security live defect registry (QA_Tracker/RBAC/). Other RBAC/ documents (architecture analysis, gap analysis, permission matrix, test plans/specs, one-time audit findings) are reference/test-plan material, not defect registries, and were not converted.' },
  { slug: 'tenant-isolation', name: 'Multi-Tenant Isolation', scope: 'platform', qaAgent: 'Tenant_Isolation_QA_Agent', sourceTrackers: ['QA_Tracker/TENANT_ISOLATION/TENANT_ISOLATION_QA_LIVE_TRACKER.md'], description: "Defects converted from the Tenant Isolation live defect registry. Source uses the same alternate column schema as Risk Register (Priority/Component/ISO-Privacy Ref/Affected Files)." },
  { slug: 'cloud-posture', name: 'Cloud Posture', scope: 'feature', qaAgent: 'Cloud_Posture_QA_Agent', sourceTrackers: ['QA_Tracker/CLOUD_POSTURE_BUGS_FOUND.csv'], description: "Defects converted from the Cloud Posture bug-found CSV (not a live tracker .md — has severity + description but no OPEN/FIXED status lifecycle, just a one-time 'Verified' flag; status defaulted to 'open' for all rows, verified flag carried separately)." },
];

const root = path.join(__dirname, '..', 'data');
const defectsDir = path.join(root, 'defects');

for (const m of MODULES) {
  const dir = path.join(defectsDir, m.slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    slug: m.slug,
    name: m.name,
    scope: m.scope,
    qaAgent: m.qaAgent,
    sourceTrackers: m.sourceTrackers,
    description: m.description,
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: MODULES.map(m => ({ slug: m.slug, name: m.name, scope: m.scope })),
};
fs.writeFileSync(path.join(defectsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${MODULES.length} defect entities and data/defects/manifest.json`);
