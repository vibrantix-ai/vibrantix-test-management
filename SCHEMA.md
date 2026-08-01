# Test Case Schema & File Layout

This document is the reference to hand to Claude (or any engineer) when asking for gap
analysis, new test cases, or edits to existing ones. It fully describes the on-disk format —
you should not need to read the app code to understand or edit test data.

## Directory layout

```
test-management-system/
├── data/
│   ├── manifest.json                 # list of all categories + all modules (slug/name/scope)
│   └── modules/
│       └── <module-slug>/
│           ├── _meta.json            # module metadata (name, routes, owning QA agent, description)
│           ├── unit.json             # array of test cases, category="unit"
│           ├── integration.json
│           ├── e2e.json
│           ├── security.json
│           ├── smoke.json
│           ├── sanity.json
│           ├── regression.json       # optional — omit the file if a module has none
│           ├── performance.json      # optional
│           └── accessibility.json    # optional
├── schema/test-case.schema.json      # formal JSON Schema for a single test case object
├── app/                              # static HTML/CSS/JS viewer (no build step)
└── scripts/seed-modules.js           # regenerates manifest.json + _meta.json only
```

**One file per module per category.** This is deliberate: it keeps each file small enough to
paste wholesale into a Claude conversation ("here is evidence-management/e2e.json, find gaps
against the current upload flow"), and it means two people/agents editing different
categories of the same module never touch the same file.

Not every module needs every category file — only create the ones that have real content.
The HTML viewer probes for all 9 category files per module and silently skips any that 404,
so omitting a file is always safe and requires no manifest change.

## `_meta.json` (one per module)

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

`scope` is `"feature"` for a page/module with its own routes, or `"platform"` for cross-cutting
concerns (RBAC, tenant isolation, performance, UI/UX, security, cross-service E2E) that don't
map to a single page.

## Test case object

See [schema/test-case.schema.json](schema/test-case.schema.json) for the enforceable schema.
Plain-English summary:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<MODULE-PREFIX>-<CATEGORY-CODE>-<seq>`, e.g. `EVID-E2E-001`. Never renumber a published ID — deprecate instead of deleting. |
| `module` | yes | Must equal the parent folder's slug. |
| `category` | yes | Must equal the parent filename and be one of the 9 categories in `manifest.json`. |
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

## Using this with Claude for gap analysis / maintenance

Because files are split per module+category, you can feed Claude exactly the slice that's
relevant:

- **Gap analysis for one area:** paste `data/modules/<slug>/<category>.json` plus a description
  of the current code behavior, and ask "what test cases are missing here?"
- **Platform change ripple:** if a shared component changes (e.g. RBAC middleware), point
  Claude at `data/modules/rbac-security/*.json` plus the modules whose `_meta.json` reference
  the affected routes.
- **New module:** copy the `_meta.json` shape above, add the slug to `data/manifest.json`
  under `modules`, then add whichever category files apply.
- Keep IDs, `module`, and `category` fields internally consistent — the viewer trusts the data
  and does not validate against the JSON Schema at runtime. Run a JSON Schema validator over
  `data/modules/**/*.json` in CI if you want that enforced.

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
server exposes `PUT /api/test-case` which re-reads the target `data/modules/<slug>/<category>.json`
file from disk, patches the one matching `id`, and writes the whole array back with the same
2-space-indent formatting used everywhere else in this repo (so `git diff` stays minimal). Only
`execution`, `automationStatus`, and `automationRef` can be changed this way; the endpoint
rejects any other field, and validates `module`/`category` against a strict slug pattern to
prevent writing outside `data/modules/`.

**Caveat on `automationStatus`/`automationRef`:** these fields describe whether a matching
automated test exists in `test-framework/`/`test-automation/` elsewhere in this repo — this
system itself has no test runner and executes nothing. Treat pre-filled values as claims to be
verified, not facts: a repo-wide check found the majority of existing `automationRef` pointers
either cited production source code instead of a test file, or named a plausible-looking test
file that doesn't actually exist. Correct these by hand via the Automation panel as you confirm
(or disprove) each one.
