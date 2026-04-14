---
name: Module Architecture
description: Exam module isolation, sub-module structure, shared-lib, module registry, canary rollout
type: project
---

## Implementation Status

| Module | Status | Version | Committed |
|---|---|---|---|
| rrb-group-d | ✅ COMPLETE | v1.0.0 | dev branch, 2026-04-14 |
| rrb-ntpc | planned | — | — |
| rrb-je | planned | — | — |
| rrb-alp | planned | — | — |

`rrb-group-d` is the reference implementation — all future modules follow its file structure.

## Core Principle

One exam = one module. One stage within an exam = one sub-module.
If one sub-module fails, other sub-modules and all other exam modules keep running.

## Platform Architecture Decision

**Platforms (web/mobile/desktop) are NOT sub-modules inside exam modules.**

```
WRONG ✗
modules/rrb-group-d/sub-modules/web/
modules/rrb-group-d/sub-modules/mobile/
modules/rrb-group-d/sub-modules/desktop/
→ 50 exams × 3 platforms = 150 sub-modules of duplicate UI code

CORRECT ✓
modules/rrb-group-d/    ← JSON API + business logic only
apps/web/               ← ONE app, reads any module's API
apps/mobile/            ← ONE app (phone + tablet), reads any module's API
apps/desktop/           ← ONE app (v2), reads any module's API
```

**Why:** Timer, palette, navigation, submit — identical across all exams.
Only colors and config differ per exam — those come from `GET /config` at runtime.
Tablet = mobile with wider layout (palette_cols: 8, split view) — not a separate sub-module.

Sub-modules inside an exam module are for **exam stages only**
(e.g. ntpc-cbt1, ntpc-cbt2, alp-cbt1, alp-cbt2a, alp-cbt2b).

## Module Structure

```
modules/
  ├── rrb-ntpc/               ← one exam = one module
  │   ├── index.ts
  │   ├── error-boundary.ts   ← catches crashes, shows fallback
  │   ├── theme.ts            ← colors, logo, fonts
  │   ├── wrangler.toml       ← own CF Worker deployment
  │   ├── package.json        ← pins shared-lib version
  │   ├── CHANGELOG.md
  │   ├── sub-modules/
  │   │   ├── cbt1/           ← sub-module per stage
  │   │   └── cbt2/
  │   └── tests/
  │
  ├── rrb-group-d/            ← single stage, no sub-modules
  ├── rrb-je/
  │   └── sub-modules/
  │       ├── cbt1/
  │       └── cbt2/           ← dept variants inside (civil/elec/mech)
  ├── rrb-alp/
  │   └── sub-modules/
  │       ├── cbt1/
  │       ├── cbt2a/          ← Part A merit
  │       └── cbt2b/          ← Part B qualifying
  ├── rrb-rpf-si/             ← separate exam = separate module
  ├── rrb-rpf-constable/
  ├── upsc-cse/
  │   └── sub-modules/
  │       ├── prelims/
  │       ├── mains/
  │       └── interview/
  └── sbi-po/
      └── sub-modules/
          ├── prelims/
          ├── mains/
          └── interview/
```

## No Shared Library — Each Module Is Fully Independent

**Decision (2026-04-14):** No shared-lib package. Every exam module owns its full stack.

**Why:**
- Shared-lib version mismatch breaks all modules at once
- One change in shared-lib forces testing of all 50+ modules
- Each exam module independently deployable with zero coordination
- HTMX + Tailwind loaded from public CDN per module — no npm deps for UI

Each module duplicates what it needs (marking engine, TSF builder, timer logic).
Duplication is intentional — independence is worth it at this scale.

## Module = Complete Vertical Slice

**Flat structure — max 3 levels deep from module root. No subfolders inside backend/ or frontend/.**

```
modules/rrb-group-d/
  backend/              ← CF Worker (JSON API) — max 6 flat files
    worker.js           ← entry point + router (was index.js)
    config.js           ← exam pattern (sections, marking, timing)
    tsf.js              ← TSF create/update (was tsf-builder.js)
    marking.js          ← scoring, exact 1/3 (was marking-engine.js)
    tenant.js           ← 3-level tenant resolution (was tenant-config.js)
    theme.js            ← colors matching real exam interface
  frontend/             ← Static UI (HTMX + Tailwind CDN) — max 5 flat files
    index.html          ← exam shell
    app.js              ← timer, palette, navigation
    storage.js          ← IndexedDB: result queue + meta
    sync.js             ← batch flush: 4 results OR 24h
    sw.js               ← service worker
  tests/                ← flat, named after what they test
    marking.test.js
    tsf.test.js
  package.json
  wrangler.toml         ← main="backend/worker.js" + [assets] dir="./frontend"
  CHANGELOG.md
```

CF Worker serves BOTH:
- JSON API routes (`/config`, `/session`, `/:id/answer`, `/results/batch`)
- Static frontend assets from `frontend/` via `[assets]` binding

HTMX + Tailwind loaded from public CDN in `index.html` — zero build step, zero npm deps for UI.

## Naming Conventions (short names)

| Old name | New name | Reason |
|---|---|---|
| `index.js` | `worker.js` | Immediately clear it's the CF Worker entry |
| `tsf-builder.js` | `tsf.js` | Shorter, still obvious |
| `marking-engine.js` | `marking.js` | Shorter |
| `tenant-config.js` | `tenant.js` | Shorter |
| `src/` | `backend/` | Unambiguous — backend vs frontend |
| `ui/` | `frontend/` | Unambiguous |

## No apps/ Directory

Everything lives inside `modules/`. There is no top-level `apps/` folder.

```
modules/
  app-shell/            ← login, home screen, navigation (one module)
    mobile/
      App.js            ← React Native root + navigation
      HomeScreen.js     ← lists available exam modules
      LoginScreen.js    ← auth
    desktop/            ← Electron shell (v2)
    package.json

  rrb-group-d/          ← exam module: owns ALL its platform UIs
    backend/            ← CF Worker API
    frontend/           ← web (HTMX + Tailwind CDN)
    mobile/             ← React Native screens for this exam
      ExamScreen.js     ← exam UI (question, palette, timer)
      ResultScreen.js   ← result display
    desktop/            ← Electron UI (v2)
    tests/
    package.json
    wrangler.toml
```

## Mobile Folder Structure (per module)

```
rrb-group-d/mobile/
  ExamScreen.js         ← full exam UI (question, palette, timer, action bar)
  ResultScreen.js       ← score, section breakdown
  components/           ← module-specific components only
    QuestionCard.js
    Palette.js          ← phone: bottom-sheet | tablet: sidebar
    Timer.js
    ActionBar.js
  services/
    api.js              ← calls this module's CF Worker API
    storage.js          ← expo-sqlite (result queue)
    sync.js             ← 4 results OR 24h flush
  utils/
    layout.js           ← isTablet = width >= 768
```

## Desktop Folder Structure (per module) — v2

```
rrb-group-d/desktop/
  ExamWindow.js         ← Electron renderer for exam
  ResultWindow.js
  package.json
```

## Isolation Levels

| Level | Mechanism |
|---|---|
| Crash | Error boundary per module — one crash shows fallback, others unaffected |
| Deploy | Each module has own wrangler.toml — deploy independently |
| Config | Each module has own KV namespace, own Parameter Store keys |
| Data | Modules write to own event stream prefix (rrb-ntpc/*) |
| CI | Per-module GitHub Actions workflow — one failure doesn't block others |

## Module Registry (KV)

```json
"registry:rrb-ntpc": {
  "stable": "v1.4.2",
  "canary": "v1.5.0",
  "canary_pct": 5,
  "canary_tenants": ["allen"],
  "rollback": "v1.3.8"
}
```

Shell reads registry → routes traffic by version. Same student always gets same version (hash(uid) % 100).

## Canary Rollout Flow

```
Deploy v1.5.0 → set canary_pct=5 → monitor 15 min
  errors normal → bump to 50 → 100 → stable = v1.5.0
  errors spike  → canary_pct=0 (instant rollback, < 1 second, no redeploy)
```

## Module Versioning

```
shared-lib        → semver (v2.1.0) — breaking change = major bump
module-rrb-ntpc   → semver (v1.4.2) — independent per module

Modules pin shared-lib version:
  "shared-lib": "^1.4.2"   ← won't auto-upgrade to v2.x
  
Breaking change in shared-lib:
  1. v2.0.0 released
  2. modules migrate one by one on own timeline
  3. v1 and v2 both supported during transition (3 month deprecation notice)
```

## TSF Integrity Block

Every test session file records exact module version:

```json
"integrity": {
  "tsf_version": "1.0.0",
  "module_id": "rrb-ntpc-cbt1",
  "module_version": "v1.4.2",
  "shared_lib_ver": "v2.1.0",
  "generated_at": "ISO timestamp",
  "q_hash": "sha256:...",
  "tenant_id": "allen",
  "is_mock": true,
  "canary": false,
  "min_app_version": "1.3.0"
}
```

Use case: bug found in v1.5.0 → query all TSFs with that version → regrade all affected.

## Question Type Plugin Registry

```typescript
// shared-lib/question-renderer/registry.ts
registry.register('S', MCQSingleRenderer)
registry.register('M', MCQMultipleRenderer)
registry.register('N', NumericalRenderer)
registry.register('V', AudioRenderer)       // new type — just add here

// No if/else. No shared-lib change for new types.
// New type = new plugin file + register = done.
```

## Module Scaffolding

```bash
npm run create-module rrb-ntpc-cbt1

# generates:
modules/rrb-ntpc-cbt1/
  ├── package.json
  ├── wrangler.toml
  ├── src/index.ts
  ├── src/config.ts      ← TSF config template
  ├── src/theme.ts
  ├── src/error-boundary.ts
  ├── tests/index.test.ts
  └── CHANGELOG.md
```

## Health Monitoring

Each module exposes GET /health → Prometheus scrapes independently:
```
rrb_ntpc_module_up   1
rrb_groupd_module_up 1
ssc_cgl_module_up    0   ← only this fires alert
```

Alert fires only for failing module. No noise for healthy modules.
