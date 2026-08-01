# Vibrantix Test Management System

A modular, file-based test case repository for the Vibrantix GRC platform, rendered by a
static HTML viewer with filtering and Excel/CSV export — for SDET review, automation
planning, and release testing sign-off.

There is no database and no build step. Test cases live as plain JSON files under
`data/modules/`, one file per module per test category, so they stay easy to diff in git,
easy to hand to Claude as scoped context, and easy for multiple people to edit without
merge conflicts.

## Quick start

```bash
node server.js        # or: npm start
# open http://localhost:4500
```

A server is required (not `file://`) because the viewer `fetch()`s local JSON files, which
browsers block under CORS from the filesystem. `server.js` has zero dependencies — just Node.

## What's here

```
test-management-system/
├── data/
│   ├── manifest.json              # categories list + module registry
│   └── modules/<slug>/             # one folder per module (30 seeded from the QA agent roster)
│       ├── _meta.json              # module name, routes, owning QA agent, description
│       └── <category>.json         # e.g. unit.json, e2e.json, security.json — omit if empty
├── schema/test-case.schema.json    # formal JSON Schema for one test case object
├── SCHEMA.md                       # human-readable schema + conventions — read this first
├── app/                            # static viewer (index.html, styles.css, app.js)
│   └── vendor/xlsx.full.min.js     # vendored SheetJS — export works fully offline
├── scripts/seed-modules.js         # regenerates manifest.json + _meta.json (never touches test data)
└── server.js
```

Full field-by-field documentation, the module folder convention, and worked examples are in
[SCHEMA.md](SCHEMA.md).

## Categories

`unit`, `integration`, `e2e`, `security`, `smoke`, `sanity`, `regression`, `performance`,
`accessibility` — defined in `data/manifest.json`. All are filterable in the viewer and become
separate tabs in the Excel export. A module doesn't need every category; only create the files
that have real content.

## The viewer

- Faceted filters: category, priority, type (manual/automated/both), automation status, status,
  module, tags, and free-text search across title/steps/expected result/tags.
- Click a row to open the full test case (preconditions, steps, expected result, traceability).
- **Export to Excel** — writes an `.xlsx` with an "All Test Cases" sheet plus one sheet per
  category present in the current filtered view, respecting whatever filters are active.
- **Export CSV** — same filtered rows, single flat file, for quick diffing or import into other
  tools.

Exports always reflect the *current filters* — filter down to `module=evidence-management,
category=e2e, status=active` before exporting to hand a release-testing team exactly their
scope.

## Adding or updating test cases

1. Read [SCHEMA.md](SCHEMA.md) for the field reference and an example object.
2. Open (or create) `data/modules/<slug>/<category>.json` — it's a plain JSON array of test
   case objects.
3. Follow the ID convention already used in that module (`<PREFIX>-<CATEGORY-CODE>-<seq>`).
   Never renumber a published ID; set `status: "deprecated"` instead of deleting.
4. Refresh the viewer (it re-fetches on every load, no cache to bust).

### Adding a brand-new module

1. Add an entry to `MODULES` in `scripts/seed-modules.js` and run `npm run seed` — it creates
   the folder, `_meta.json`, and updates `data/manifest.json` without touching any existing
   test data.
2. Add category files as needed.

### Using Claude to find gaps or write new cases

Because each `<module>/<category>.json` file is small and self-contained, paste the relevant
file(s) plus a description of the current feature behavior and ask Claude to identify missing
coverage or draft new cases in the same schema. See the "Using this with Claude" section at
the bottom of [SCHEMA.md](SCHEMA.md) for the recommended framing.

## Module registry

The 30 seeded modules mirror the platform's existing QA agent ecosystem (see each module's
`_meta.json` for its `qaAgent` field) — `dashboard-overview`, `evidence-management`,
`policy-management`, `risk-register`, `audit-assurance`, `vendor-management`, `trust-vault`,
`grc-framework`, `smart-compliance`, `intelli-audit`, `cloud-posture`, `compliance-vault`,
`integrations`, `notifications`, `onboarding`, `organization-management`, `billing-plans`,
`profile-settings`, `project-management`, `tasks`, `support`, `vciso`, `ai-assistant`,
`ai-evidence`, plus the platform-wide modules `rbac-security`, `tenant-isolation`,
`security-vulnerability`, `performance`, `ui-ux`, `api-contract-e2e`.

Initial test case content for each module was authored by delegating to that module's
specialized QA agent (already deeply familiar with the module's real code paths and known
defects), rather than generated generically — keep doing this when a module's underlying
feature changes materially, so test cases stay grounded in actual behavior rather than
drifting into speculation.
