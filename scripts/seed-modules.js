// One-time scaffold script: creates data/manifest.json and data/modules/<slug>/_meta.json
// for every module tracked by the Vibrantix QA agent ecosystem. Safe to re-run — it only
// ever writes _meta.json and manifest.json, never touches hand-authored category files.
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'unit', 'integration', 'e2e', 'security', 'smoke', 'sanity', 'regression', 'performance', 'accessibility'
];

const MODULES = [
  { slug: 'dashboard-overview', name: 'Dashboard Overview', routes: ['/dashboard'], qaAgent: 'Dashboard_Overview_QA_Agent', scope: 'feature', description: 'Main dashboard KPI cards, cross-module aggregation, widgets, quick actions.' },
  { slug: 'evidence-management', name: 'Evidence Management', routes: ['/evidence-management'], qaAgent: 'Evidence_Management_QA_Agent', scope: 'feature', description: 'Evidence upload, versioning, review workflow, retention, control mapping.' },
  { slug: 'policy-management', name: 'Policy Management', routes: ['/policy-management'], qaAgent: 'Policy_Management_QA_Agent', scope: 'feature', description: 'Policy lifecycle (draft/review/approval/active), AI generation, templates, framework mapping.' },
  { slug: 'risk-register', name: 'Risk Register & Risk Center', routes: ['/risk-register', '/risk-center'], qaAgent: 'Risk_Register_QA_Agent', scope: 'feature', description: 'Risk identification, scoring, treatment plans, acceptance workflow, risk center analytics.' },
  { slug: 'audit-assurance', name: 'Audit Assurance', routes: ['/audit-assurance'], qaAgent: 'Audit_Assurance_QA_Agent', scope: 'feature', description: 'Audit lifecycle, findings, CAR management, nonconformity tracking, management review.' },
  { slug: 'vendor-management', name: 'Vendor Management', routes: ['/vendor-management'], qaAgent: 'Vendor_Management_QA_Agent', scope: 'feature', description: 'Vendor onboarding, assessments, trust score, vendor portal, Trust Network sharing.' },
  { slug: 'trust-vault', name: 'Trust Vault', routes: ['/trust-vault'], qaAgent: 'Trust_Vault_QA_Agent', scope: 'feature', description: 'Certification lifecycle, share links, Trust Network sharing, vault health scoring.' },
  { slug: 'grc-framework', name: 'GRC Framework', routes: ['/grc-framework'], qaAgent: 'GRC_Framework_QA_Agent', scope: 'feature', description: 'Framework catalog, activation, compliance map, control coverage, PCL sync.' },
  { slug: 'smart-compliance', name: 'Smart Compliance', routes: ['/smart-compliance'], qaAgent: 'Smart_Compliance_QA_Agent', scope: 'feature', description: 'AI questionnaire, evidence auto-mapping, control coverage calculation.' },
  { slug: 'intelli-audit', name: 'Intelli Audit', routes: ['/intelli-audit'], qaAgent: 'Intelli_Audit_QA_Agent', scope: 'feature', description: 'AI audit plan generation, scope customisation, scheduling, plan-to-audit handoff.' },
  { slug: 'cloud-posture', name: 'Cloud Posture', routes: ['/cloud-posture'], qaAgent: 'Cloud_Posture_QA_Agent', scope: 'feature', description: 'Multi-cloud scanning via Prowler, posture dashboard, service drill-down, control auto-mapping.' },
  { slug: 'compliance-vault', name: 'Compliance Vault', routes: ['/compliance-vault'], qaAgent: 'Compliance_Vault_QA_Agent', scope: 'feature', description: 'Evidence collections, certification storage, vault workflow, Google Drive integration.' },
  { slug: 'integrations', name: 'Integrations', routes: ['/integrations'], qaAgent: 'Integrations_QA_Agent', scope: 'feature', description: 'Integration hub, OAuth flows, Google Drive sync, connection health, credential security.' },
  { slug: 'notifications', name: 'Notifications', routes: [], qaAgent: 'Notifications_QA_Agent', scope: 'platform', description: 'Notification dispatch pipeline, Socket.IO real-time delivery, unread state, BullMQ queue.' },
  { slug: 'onboarding', name: 'Onboarding & Getting Started', routes: ['/getting-started', '/onboarding'], qaAgent: 'Onboarding_QA_Agent', scope: 'feature', description: 'First-run wizard, step completion tracking, checklist, platform tour.' },
  { slug: 'organization-management', name: 'Organization Management', routes: ['/organization'], qaAgent: 'Organization_Management_QA_Agent', scope: 'feature', description: 'Org profile, team management, roles/permissions, security policy, departments.' },
  // Description/routes updated 2026-08-14 after the 2026-08-04 billing rewrite (Stripe +
  // org-level subscription-tier model deleted entirely) was confirmed via code analysis —
  // the prior text was stale, still describing deleted Stripe/seat-limit mechanics and
  // omitting the MSSP usage-billing surface and admin billing UI that now exist.
  { slug: 'billing-plans', name: 'Billing & Plans', routes: ['/billing', '/billing-plans', '/mssp/usage-billing'], qaAgent: 'Billing_Plans_QA_Agent', scope: 'feature', description: 'Public plan catalog, V2 entitlement ledger (reserve/commit/cancel), AI-credits lifecycle, subscription-change request workflow (submit/approve/reject/escalate), admin plan-catalog & tier management, and MSSP cross-client billing consolidation views.' },
  { slug: 'profile-settings', name: 'Profile Settings', routes: ['/profile'], qaAgent: 'Profile_Settings_QA_Agent', scope: 'feature', description: 'User profile fields, notification preferences, account activity, MFA flag.' },
  { slug: 'project-management', name: 'Project Management', routes: ['/project-management'], qaAgent: 'Project_Management_QA_Agent', scope: 'feature', description: 'Project creation wizard, project-scoped data filtering, multi-project isolation.' },
  { slug: 'tasks', name: 'Centralised Tasks', routes: ['/tasks'], qaAgent: 'Tasks_QA_Agent', scope: 'feature', description: 'Cross-module task aggregation from 9 entity types, filters, overdue flags.' },
  { slug: 'support', name: 'Support', routes: ['/support'], qaAgent: 'Support_QA_Agent', scope: 'feature', description: 'Bug report lifecycle, Jira sync, comment threads, webhook handling.' },
  { slug: 'vciso', name: 'vCISO Suite', routes: ['/vciso'], qaAgent: 'vCISO_QA_Agent', scope: 'feature', description: 'Executive dashboard, strategic planning, risk intelligence, board reporting, AI advisor.' },
  { slug: 'ai-assistant', name: 'AI Assistant', routes: ['/assistant'], qaAgent: 'AI_Assistant_QA_Agent', scope: 'feature', description: 'RAG pipeline, tenant-scoped retrieval, citation accuracy, streaming responses.' },
  { slug: 'ai-evidence', name: 'AI Evidence', routes: ['/ai-evidence'], qaAgent: 'AI_Evidence_QA_Agent', scope: 'feature', description: 'AI-assisted upload, classification suggestions, review/override, S3 + BullMQ pipeline.' },
  { slug: 'rbac-security', name: 'RBAC & Access Control', routes: [], qaAgent: 'RBAC_Security_QA_Agent', scope: 'platform', description: 'Authn/authz layer, role/permission model, route guards, privilege escalation, IDOR.' },
  { slug: 'tenant-isolation', name: 'Multi-Tenant Isolation', routes: [], qaAgent: 'Tenant_Isolation_QA_Agent', scope: 'platform', description: 'Cross-tenant leakage, fresh-tenant zero-data guarantees, cache/index namespace isolation.' },
  { slug: 'security-vulnerability', name: 'Security Vulnerability', routes: [], qaAgent: 'Security_Vulnerability_QA_Agent', scope: 'platform', description: 'OWASP Top 10/API Top 10, injection classes, secrets exposure, dependency/container risk.' },
  { slug: 'performance', name: 'Performance', routes: [], qaAgent: 'Performance_QA_Agent', scope: 'platform', description: 'Core Web Vitals, API latency SLAs, N+1 queries, cache hit-rate, queue throughput.' },
  { slug: 'ui-ux', name: 'UI/UX Consistency', routes: [], qaAgent: 'UI_UX_QA_Agent', scope: 'platform', description: 'Design-system compliance, dark mode fidelity, accessibility baseline, responsive layout.' },
  { slug: 'api-contract-e2e', name: 'API Contract & Cross-Service E2E', routes: [], qaAgent: 'API_Contract_E2E_QA_Agent', scope: 'platform', description: 'The 5 critical cross-service E2E flows, API contract stability, error propagation.' },
  // No dedicated QA agent exists yet for VTEC (checked against the full agent list in
  // CLAUDE.md/system reminders — none covers it) — qaAgent is null rather than a guessed
  // value, matching this repo's own "flag gaps rather than invent data" convention. Spans
  // two new repos (vtec-connector: Go edge binary; vtec-management-service: TS/Fastify) plus
  // vibrantix-backend's /api/vtec proxy and vibrantix-client-panel's /vtec module — tests
  // here span all four rather than being scoped to one route the way most Modules entries are.
  { slug: 'vtec', name: 'VTEC (Vibrantix Trust Edge Connector)', routes: ['/vtec'], qaAgent: null, scope: 'feature', description: 'On-premises edge connector fleet (Go binary + vtec-management-service) for OT/air-gapped evidence collection: mTLS bootstrap/rotation, credential relay via Vault, 9-stage edge pipeline (mask/compress/encrypt before anything leaves the network), offline buffering, Prometheus monitoring, and the client-panel fleet/workflow/credentials UI. See Architecture/VTEC/VTEC_IT_LAN_P1_ADAPTERS_IMPLEMENTATION_PLAN.md.' },
  // No dedicated QA agent exists yet for MSSP (same situation as VTEC above) — qaAgent is
  // null rather than guessed. Newly discovered (2026-08-14) via code analysis: was previously
  // untracked in this registry, with only a handful of portal-boundary test cases misfiled
  // under rbac-security. Spans vibrantix-backend's src/modules/mssp/ (provider/client models,
  // tenant provisioning, portal-boundary middleware), vibrantix-client-panel's (mssp) route
  // group, the standalone vibrantix-partner-portal app (productionized MSSP portal), and
  // vibrantix-admin-panel's /tenant-management/mssps provider management UI.
  { slug: 'mssp', name: 'MSSP (Managed Security Service Provider)', routes: ['/mssp'], qaAgent: null, scope: 'feature', description: 'Provider organizations managing multiple client tenant orgs under a delegated-access model: client provisioning (tenant-provisioning.service.js), cross-org dashboard/usage/billing consolidation, subscription-change request workflow, compliance-framework licensing, provider team & invitations, ownership detach/transfer, append-only audit trail, and hard portal/tenant boundary isolation (portalBoundary.js + client-panel middleware.js) so MSSP and customer users can never cross into each other\'s routes. Spans vibrantix-backend, vibrantix-client-panel, the standalone vibrantix-partner-portal app, and vibrantix-admin-panel.' },
];

const root = path.join(__dirname, '..', 'data');
const modulesDir = path.join(root, 'modules');

for (const m of MODULES) {
  const dir = path.join(modulesDir, m.slug);
  fs.mkdirSync(dir, { recursive: true });
  const metaPath = path.join(dir, '_meta.json');
  const meta = {
    slug: m.slug,
    name: m.name,
    scope: m.scope,
    routes: m.routes,
    qaAgent: m.qaAgent,
    description: m.description,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

const manifest = {
  categories: CATEGORIES,
  entities: MODULES.map(m => ({ slug: m.slug, name: m.name, scope: m.scope })),
};
fs.writeFileSync(path.join(modulesDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote _meta.json for ${MODULES.length} modules and data/modules/manifest.json`);
