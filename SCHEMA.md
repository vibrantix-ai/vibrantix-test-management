# Test Case Schema & File Layout

This document is the reference to hand to Claude (or any engineer) when asking for gap
analysis, new test cases, or edits to existing ones. It fully describes the on-disk format —
you should not need to read the app code to understand or edit test data.

## Directory layout

This shape is repeated identically for each of the 6 systems (`modules`, `frameworks`, `logs`,
`audit-reports`, `integrations`, `defects`) — only the entity's `_meta.json` fields differ per
system, and `defects` uses a severity axis instead of the 9 QA categories (see below).

```
test-management-system/
├── data/
│   ├── manifest.json                 # top-level index: the 6 systems (slug, name, entityLabel, dataDir, description, recordKind)
│   ├── modules/
│   │   ├── manifest.json             # this system's categories list + entity registry (slug/name/scope)
│   │   └── <module-slug>/
│   │       ├── _meta.json            # module metadata (name, routes, owning QA agent, description)
│   │       ├── unit.json             # array of test cases, category="unit"
│   │       ├── integration.json
│   │       ├── e2e.json
│   │       ├── security.json
│   │       ├── smoke.json
│   │       ├── sanity.json
│   │       ├── regression.json       # optional — omit the file if an entity has none
│   │       ├── performance.json      # optional
│   │       └── accessibility.json    # optional
│   ├── frameworks/<framework-slug>/...     # same shape, entity = compliance framework
│   ├── logs/<log-source-slug>/...          # same shape, entity = a module's log source
│   ├── audit-reports/<report-slug>/...     # same shape, entity = a framework's audit report
│   ├── integrations/<connector-slug>/...   # same shape, entity = a connector
│   └── defects/<module-slug>/              # entity = module; categories = ["critical","high","medium","low"]
│       ├── _meta.json                      # slug, name, scope, qaAgent, sourceTrackers[], description
│       ├── critical.json                   # array of defect objects, severity="Critical"
│       ├── high.json
│       ├── medium.json
│       └── low.json                        # each optional — omit if that module has none at that severity
├── schema/
│   ├── test-case.schema.json         # formal JSON Schema for a test case object (Modules/Frameworks/Logs/Audit Reports/Integrations)
│   └── defect.schema.json            # formal JSON Schema for a defect object (Defects system only)
├── app/                              # static HTML/CSS/JS viewer (no build step) — system tabs at the top
└── scripts/
    ├── seed-systems.js               # regenerates data/manifest.json (the systems index) only
    ├── seed-modules.js               # regenerates data/modules/manifest.json + _meta.json only
    ├── seed-frameworks.js            # regenerates data/frameworks/manifest.json + _meta.json only
    ├── seed-logs.js                  # regenerates data/logs/manifest.json + _meta.json only
    ├── seed-audit-reports.js         # regenerates data/audit-reports/manifest.json + _meta.json only
    ├── seed-integrations.js          # regenerates data/integrations/manifest.json + _meta.json only
    └── seed-defects.js               # regenerates data/defects/manifest.json + _meta.json only
```

**One file per entity per category (or severity, for Defects).** This is deliberate: it keeps
each file small enough to paste wholesale into a Claude conversation ("here is
evidence-management/e2e.json, find gaps against the current upload flow"), and it means two
people/agents editing different categories of the same entity never touch the same file.

Not every entity needs every category file — only create the ones that have real content.
The HTML viewer probes for all category files per entity (9 for the test-case-shaped systems,
4 for Defects) and silently skips any that 404, so omitting a file is always safe and requires
no manifest change. Frameworks/Logs/Audit Reports/Integrations currently have **zero** category
files — only entity scaffolding — content is a later phase. Defects has real content already
(~434 defects, converted from `QA_Tracker/` — see README.md's "Defects conversion scope").

## Top-level `data/manifest.json` (the systems index)

```json
{
  "systems": [
    { "slug": "modules", "name": "Module Test Management System", "entityLabel": "Module", "dataDir": "modules", "description": "..." },
    { "slug": "frameworks", "name": "Frameworks Test Management System", "entityLabel": "Framework", "dataDir": "frameworks", "description": "..." },
    { "slug": "defects", "name": "AI Defects Management System", "entityLabel": "Module", "dataDir": "defects", "recordKind": "defect", "description": "..." }
  ]
}
```

`dataDir` is the folder under `data/` for that system; `entityLabel` is the singular noun the
viewer uses for that system's filter heading, table column, and export column (e.g. "Framework"
pluralizes to "Frameworks" in UI text). `recordKind: "defect"` is how the viewer (`app.js`'s
`isDefectsSystem()`) knows to render the defect-shaped UI instead of the test-case-shaped one —
absent/any other value means test-case-shaped.

## Per-system `data/<dataDir>/manifest.json`

Same shape for every system: `{ "categories": [...], "entities": [...] }`, where each entity
object always has at least `slug` and `name`, plus system-specific fields mirrored from that
system's `_meta.json` (see below). `categories` is the 9 QA categories for every system except
`defects`, which uses `["critical", "high", "medium", "low"]`.

## `_meta.json` (one per entity)

Every system's entity `_meta.json` has `slug`, `name`, `description`, and (for Frameworks/Logs/
Audit Reports/Integrations, which are scaffolding-only so far) a `testFocusAreas` array —
guidance for the next phase's test-case authors, not test cases themselves. Beyond that, fields
are system-specific:

**modules** — `scope` (`"feature"` for a page/module with its own routes, or `"platform"` for
cross-cutting concerns like RBAC/tenant isolation/performance/UI-UX/security/cross-service E2E),
`routes`, `qaAgent`:

```json
{
  "slug": "evidence-management",
  "name": "Evidence Management",
  "scope": "feature",
  "routes": ["/evidence-management"],
  "qaAgent": "Evidence_Management_QA_Agent",
  "description": "Evidence upload, versioning, review workflow, retention, control mapping."
}
```

**frameworks** — `version`, `frameworkType` (`standard`/`regulation`/`framework`), `family`:

```json
{
  "slug": "iso-27001",
  "name": "ISO/IEC 27001",
  "version": "2022",
  "frameworkType": "standard",
  "family": "ISO",
  "description": "Information security management system standard — Annex A controls and Clauses 4-10.",
  "testFocusAreas": ["Requirement CRUD & versioning", "Requirement-to-UCL control mapping accuracy", "..."]
}
```

**logs** — `sourceModule` (the modules-system slug this log source mirrors), `logTypes`:

```json
{ "slug": "evidence-management", "name": "Evidence Management", "sourceModule": "evidence-management", "logTypes": ["audit", "activity"], "description": "...", "testFocusAreas": ["..."] }
```

**audit-reports** — `framework` (the frameworks-system slug this report is for):

```json
{ "slug": "iso-27001", "name": "ISO/IEC 27001 Audit Report", "framework": "iso-27001", "description": "...", "testFocusAreas": ["..."] }
```

**integrations** — `category`, `authMethod`, `capabilities` (drawn from
`vibrantix-connector-service`'s `connector_registry.json`):

```json
{ "slug": "okta", "name": "Okta", "category": "identity", "authMethod": "oauth2_pkce", "capabilities": ["users", "groups", "policies", "logs"], "description": "...", "testFocusAreas": ["..."] }
```

**defects** — same `scope`/`qaAgent` as modules, plus `sourceTrackers` (array of the
`QA_Tracker/` file(s) this entity's defects were converted from):

```json
{
  "slug": "evidence-management",
  "name": "Evidence Management",
  "scope": "feature",
  "qaAgent": "Evidence_Management_QA_Agent",
  "sourceTrackers": ["QA_Tracker/EVIDENCE_MANAGEMENT_QA_LIVE_TRACKER.md"],
  "description": "Defects converted from the Evidence Management live defect registry."
}
```

## Test case object

See [schema/test-case.schema.json](schema/test-case.schema.json) for the enforceable schema.
Plain-English summary:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<MODULE-PREFIX>-<CATEGORY-CODE>-<seq>`, e.g. `EVID-E2E-001`. Never renumber a published ID — deprecate instead of deleting. |
| `system` | no | One of `modules`/`frameworks`/`logs`/`audit-reports`/`integrations`. Absent means `modules` (every case written before this field existed) — no migration needed. |
| `module` | yes | The entity slug within this case's system — must equal the parent folder's slug. Named `module` for historical reasons; for non-`modules` systems it holds the framework/log-source/connector/etc. slug. |
| `category` | yes | Must equal the parent filename and be one of the 9 categories in that system's `manifest.json`. |
| `subFeature` | no | Finer grouping shown as a filter facet, e.g. `"Evidence Upload"`. |
| `title` | yes | Short imperative summary. |
| `description` | no | Longer context — use when the *why* isn't obvious from steps alone. |
| `priority` | yes | `P0` (release-blocking) / `P1` (critical) / `P2` (major) / `P3` (minor). |
| `type` | yes | `manual` / `automated` / `both`. |
| `automationStatus` | no | `automated` / `not_automated` / `planned` / `flaky`. |
| `automationRef` | no | Pointer to the actual spec file, e.g. `test-framework/tests/e2e/evidence-management.spec.ts:42`. |
| `preconditions` | no | Array of setup requirements. |
| `steps` | yes | Ordered array of actions. |
| `testData` | no | Concrete inputs/payloads. |
| `expectedResult` | yes | Observable pass/fail criterion. |
| `tags` | no | Free-form, used for filter chips — e.g. `rbac`, `multi-tenant`, `idor`, `iso27001`. |
| `requirement` | no | Traceability reference (ISO clause, story ID). |
| `linkedDefect` | no | QA tracker defect ID this case guards against regressing. |
| `owner` | no | `SDET` / `QA` / `Security` / etc. |
| `status` | yes | `active` / `draft` / `deprecated`. Deprecated cases are excluded from default view/export. |
| `createdAt` / `updatedAt` | no | `YYYY-MM-DD`. `updatedAt` is auto-bumped whenever the viewer writes a change. |
| `execution` | no | `{ result, runAt, runBy, notes }` — the *latest* run outcome only, not history. Set via the viewer's Mark Pass/Fail/Blocked/Skipped controls (see "Marking results" below), or edited by hand. Distinct from `status` (case lifecycle) and `automationStatus` (whether an automated spec exists). `result` is one of `not_run` / `pass` / `fail` / `blocked` / `skipped`. |

### Example

```json
{
  "id": "EVID-E2E-004",
  "module": "evidence-management",
  "category": "e2e",
  "subFeature": "Evidence Upload",
  "title": "Uploaded evidence appears in review queue with correct control mapping",
  "priority": "P1",
  "type": "automated",
  "automationStatus": "automated",
  "automationRef": "test-framework/tests/e2e/evidence-management.spec.ts:88",
  "preconditions": [
    "Logged in as org admin",
    "ISO 27001 framework activated for the project"
  ],
  "steps": [
    "Navigate to /evidence-management and click 'Upload Evidence'",
    "Select a PDF file and map it to control A.8.15",
    "Submit the upload"
  ],
  "expectedResult": "Evidence appears in the review queue with status 'Pending Review', correct file hash, and control mapping A.8.15 visible on the detail page.",
  "tags": ["control-mapping", "s3-upload"],
  "requirement": "ISO 27001 Annex A.8.15",
  "owner": "SDET",
  "status": "active",
  "createdAt": "2026-07-31",
  "updatedAt": "2026-07-31"
}
```

## Defect object (Defects system only)

See [schema/defect.schema.json](schema/defect.schema.json) for the enforceable schema — a
separate schema from the test-case one above, since a defect is a different kind of record
(severity + status lifecycle + narrative, not steps/expectedResult/automation).

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Original ID exactly as authored in the source tracker (`EM-001`, `RR-014`, `CD-002`). Cloud Posture's CSV had no native ID — synthesized as `CP-NNN` (row number, zero-padded) during conversion. |
| `module` | yes | Entity slug — must equal the parent folder's slug; reuses the existing Modules-system slug for the same feature. |
| `title` | yes | Short summary. For sources whose own "Title" column is itself the long description (Risk Register, Tenant Isolation, Security Vulnerability, Cloud Posture), this holds that full text verbatim. |
| `severity` | yes | `Critical` / `High` / `Medium` / `Low` — must equal the parent filename (`critical.json` etc.), capitalized. |
| `status` | yes | `open` / `fixed` / `regressed` / `in_progress` / `new` / `wont_fix` / `cannot_verify` — normalized from whatever legend/symbols the source tracker used. Editable from the viewer's detail panel (see "Updating defect status" below). |
| `statusRaw` | no | Verbatim original status text/symbol, kept whenever normalization would lose nuance (e.g. `"REOPENED (partial)"`). Doubles as a free-text status note when edited from the viewer. |
| `category` | no | Free-text domain tag from the source's own Category column (e.g. `"Audit Trail"`, `"Validation Gap"`) — distinct from `severity`, which drives the filename. |
| `description` | no | Full narrative transcribed from the source tracker's "Defect Detail Cards" section when one exists for that ID — never summarized or invented; omitted entirely if the source has no separate narrative. |
| `requirement` | no | ISO clause / regulatory reference. |
| `tags` | no | Free-form; used to fold in CWE/OWASP classifications for Security Vulnerability defects. |
| `component` | no | UI component / affected-area name. |
| `affectedFiles` | no | Array of `path/to/file.ext:line` strings. |
| `fixEvidence` | no | Description of the actual code change that fixed it, present only when relevant. |
| `firstDetected` / `lastVerified` | no | Dates from the source, where tracked. |
| `runsOpen` | no | Integer — consecutive QA runs open, where the source tracks it. |
| `sourceRun` | no | Which run in the source's Run History first surfaced this, when determinable. |
| `verified` | no | Boolean, Cloud Posture (CSV) defects only — whether independently re-confirmed. Distinct from `status`, which that source doesn't track (no OPEN/FIXED lifecycle). |
| `sourceFile` | yes | Provenance — repo-relative path to the `QA_Tracker/` source this record was converted from. |

### Example

```json
{
  "id": "EM-001",
  "module": "evidence-management",
  "title": "Hard-delete endpoint (`DELETE /:evidenceId/hard`) has no retention period check, no immutability lock on approved/submitted evidence — two clicks permanently destroys certification evidence; violates A.5.33",
  "severity": "Critical",
  "status": "open",
  "statusRaw": "🔴 OPEN",
  "category": "Retention",
  "requirement": "ISO 27001 Annex A.5.33",
  "firstDetected": "2026-05-20",
  "lastVerified": "2026-06-11",
  "runsOpen": 1,
  "sourceFile": "QA_Tracker/EVIDENCE_MANAGEMENT_QA_LIVE_TRACKER.md",
  "description": "**Files:** `vibrantix-backend/src/modules/evidence/evidence.controller.js` — `hardDeleteEvidence` handler\n**Root Cause:** ..."
}
```

### Source-tracker column mapping (for converting a new source)

`QA_Tracker/`'s live trackers use 3 different table schemas. When converting a new one, identify
which variant it matches first:

- **Baseline (9-column):** `ID | Sev | Category | Title | Status | First Detected | Last Verified | Runs Open | Fix Evidence` — maps 1:1 onto the fields above, plus fold the tracker's "Defect Detail Cards" narrative into `description` by matching ID.
- **Risk Register / Tenant Isolation variant:** `ID | Status | Priority | Component | Category | Title | ISO Ref | Affected Files` — `Priority` (e.g. `"P1 / High"`) → extract the word after the slash as `severity`; `ISO Ref` → `requirement`; `Affected Files` → split into the `affectedFiles` array; `Title` is the full text, usually no separate `description`.
- **Security Vulnerability variant:** `ID | Title | Status | Priority | CWE | OWASP | Affected Area | First Seen | Last Verified` — `CWE` + `OWASP` → both folded into the `tags` array; `Affected Area` → `component`; no `category`/`runsOpen`/`fixEvidence` columns.
- **Cloud Posture CSV (thinnest, no lifecycle):** `No., Page/Route, File(s) & Lines, Category, Severity, Bug Description, Failure Scenario / Impact, Verified` — `No.` → synthesize `CP-NNN` id; `Bug Description` → `title`; `Failure Scenario / Impact` → `description`; `status` defaults to the constant `"open"` for every row (no fix-lifecycle tracked); `Verified` → the separate `verified` boolean field, not `status`.

## Using this with Claude for gap analysis / maintenance

Because files are split per entity+category, you can feed Claude exactly the slice that's
relevant:

- **Gap analysis for one area:** paste `data/<system>/<slug>/<category>.json` plus a description
  of the current code behavior, and ask "what test cases are missing here?"
- **Platform change ripple:** if a shared component changes (e.g. RBAC middleware), point
  Claude at `data/modules/rbac-security/*.json` plus the modules whose `_meta.json` reference
  the affected routes.
- **New entity in an existing system:** copy the relevant `_meta.json` shape above, add the slug
  to that system's seed script (e.g. `scripts/seed-frameworks.js`) and run its `npm run
  seed:<system>` script, then add whichever category files apply.
- Keep IDs, `system`, `module`, and `category` fields internally consistent — the viewer trusts
  the data and does not validate against the JSON Schema at runtime. Run a JSON Schema validator
  over `data/**/*.json` in CI if you want that enforced.

## Marking results (Pass/Fail/Blocked/Skipped)

The viewer can write back to the source JSON files directly — this is the only mutation path;
everything else about a test case is authored content meant to be edited in the JSON files
themselves. Opening a row's detail panel exposes:

- **Test result** — Pass/Fail/Blocked/Skipped buttons (or "Reset to not run"), an optional
  "Run by" field (remembered in the browser via `localStorage` so you don't retype it each
  time), and a notes field. Saving sets `execution.result`, `execution.runAt` (stamped
  server-side to today), `execution.runBy`, and `execution.notes` on that case.
- **Automation** — an editable `automationStatus` dropdown and `automationRef` text field, so
  you can correct these by hand as you verify which cases actually have a matching automated
  spec (see the caveat below).

This only works when the app is served via `node server.js` (see [README.md](README.md)) — the
server exposes `PUT /api/test-case`, which accepts an optional `system` field (defaulting to
`modules` for back-compat) alongside `module`/`category`/`id`/`patch`, re-reads the target
`data/<system's dataDir>/<slug>/<category>.json` file from disk, patches the one matching `id`,
and writes the whole array back with the same 2-space-indent formatting used everywhere else in
this repo (so `git diff` stays minimal). Only `execution`, `automationStatus`, and
`automationRef` can be changed this way; the endpoint rejects any other field, validates
`system` against the known system slugs, and validates `module`/`category` against a strict slug
pattern to prevent writing outside that system's data directory.

**Caveat on `automationStatus`/`automationRef`:** these fields describe whether a matching
automated test exists in `test-framework/`/`test-automation/` elsewhere in this repo — this
system itself has no test runner and executes nothing. Treat pre-filled values as claims to be
verified, not facts: a repo-wide check found the majority of existing `automationRef` pointers
either cited production source code instead of a test file, or named a plausible-looking test
file that doesn't actually exist. Correct these by hand via the Automation panel as you confirm
(or disprove) each one.

**The Defects system has none of this** — no Mark Pass/Fail controls, no Automation panel. A
defect isn't something you "run" or automate, so `PUT /api/test-case` is simply never called
from its detail panel. It does have its own narrower write path — see "Updating defect status"
below.

## Updating defect status

The defect detail panel has a **Status** editor: a dropdown (`open` / `new` / `in_progress` /
`regressed` / `wont_fix` / `cannot_verify` / `fixed`) plus an optional free-text status-note
field (maps to `statusRaw`), and a "Save status" button. Saving `PUT`s to `/api/defect` with
`{ module, severity, id, patch: { status, statusRaw } }` — `severity` plays the role `category`
plays for the test-case endpoint, since defects are bucketed by severity file. The server
re-reads `data/defects/<module>/<severity>.json`, patches the matching `id`, auto-stamps
`lastVerified` to today (mirroring how the test-case endpoint auto-bumps `updatedAt`), and
writes the file back with the same 2-space-indent formatting. Only `status` and `statusRaw` are
patchable this way — an empty `statusRaw` clears the field rather than storing `""`. Everything
else about a defect (title, description, requirement, tags, affected files, fix evidence,
severity, source) is authored/converted content, edited by hand in the JSON files, same as a
test case's non-execution fields.
