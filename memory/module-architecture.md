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

## Shared Library (packages/shared-lib/)

Global module = shared library imported by all exam modules. NOT a running service.

| Component | Purpose |
|---|---|
| tsf-schema | TypeScript types for Test Session File |
| question-renderer | Plugin registry — renders all question types |
| timer-engine | Global + sectional countdown, grace period |
| marking-engine | Score computation, partial marking |
| event-emitter | Sends P0–P7 events to EIS |
| state-manager | Reads/writes TSF state to localStorage + expo-sqlite |
| sync-engine | Online real-time / offline batch flush |
| ui-shell | Header, palette, bottom bar, sidebar layout |
| provider-adapters | Storage, cache, queue — swappable per provider |
| compliance | DPDP consent, erasure, audit logging |
| entitlements | Feature/module access per tenant |

Each exam module imports shared-lib and provides:
- Its own TSF config (pattern, sections, marking)
- Its own theme
- Its own sub-module routing
- Its own error boundary

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
