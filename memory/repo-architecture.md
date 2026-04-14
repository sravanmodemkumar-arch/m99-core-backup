---
name: Repository Architecture
description: Monorepo structure, branch strategy, repo naming, CI/CD pipeline decisions
type: project
---

## Repo Structure — Turborepo Monorepo

Single repo. Each module acts independently via Turborepo tooling.

**Local project root:** `/home/sravan/Desktop/projects/mock-test-platform/`
**Git repo root:** `/home/sravan/Desktop/projects/` (one level up — memory/ stays here)

```
mock-test-platform/          ← actual project root
  ├── modules/
  │   ├── app-shell/         ← login, home, navigation (treated as a module)
  │   │   ├── mobile/        ← App.js, HomeScreen.js, LoginScreen.js
  │   │   ├── desktop/       ← desktop shell (v2)
  │   │   └── package.json
  │   ├── rrb-group-d/       ← fully self-contained across ALL platforms
  │   │   ├── backend/       ← CF Worker JSON API (flat, max 6 files)
  │   │   ├── frontend/      ← web: HTMX + Tailwind CDN (flat, max 5 files)
  │   │   ├── mobile/        ← React Native screens for this module
  │   │   ├── desktop/       ← Electron UI for this module (v2)
  │   │   ├── tests/         ← flat test files
  │   │   ├── package.json
  │   │   └── wrangler.toml
  │   ├── rrb-ntpc/          ← same 5-folder structure
  │   ├── ssc-cgl/           ← same 5-folder structure
  │   └── ... (50+ modules)
  ├── cf-workers/            ← platform-level CF Workers (auth, EIS)
  ├── lambda/                ← AWS Lambda services
  ├── docs/
  ├── packages/              ← empty (no shared-lib ever)
  ├── package.json           ← workspaces: modules/*
  └── turbo.json
```

**No apps/ directory.** Everything lives inside `modules/`.
**app-shell** is a module like any other — login + home + navigation for mobile/desktop.
**No shared-lib.** Each module is 100% independent across all platforms.
**Naming rule:** `backend/` = CF Worker API, `frontend/` = web, `mobile/` = RN, `desktop/` = Electron.

## Per-Module Folder Rule

Every exam module has exactly these folders:

| Folder | Purpose | Platform |
|---|---|---|
| `backend/` | CF Worker JSON API | Server |
| `frontend/` | HTMX + Tailwind CDN | Browser |
| `mobile/` | React Native screens | iOS + Android + Tablet |
| `desktop/` | Electron UI (v2) | Windows + Mac + Linux |
| `tests/` | Vitest test files | CI |

## How Mobile App Works

`app-shell/mobile/App.js` is the React Native root.
It imports exam screens from each module's `mobile/` folder:

```js
// app-shell/mobile/App.js
import RRBGroupDExam from '../../rrb-group-d/mobile/ExamScreen'
import RRBNTPCExam   from '../../rrb-ntpc/mobile/ExamScreen'
```

One installed app. Each module contributes its own screens.
Navigation lives in app-shell. Exam UI lives in each module.

**Why Turborepo:** Only rebuilds/tests affected modules. PR touching rrb-ntpc → only rrb-ntpc CI runs. No shared-lib means no cascade failures.

## Repo Name

- **Git repo name:** `m99-core` (obfuscated, not searchable in public)
- **Backup repo:** `m99-core-backup`
- **Brand name:** `PLATFORM_NAME` env var (changes everywhere in app)
- **Tenant name:** KV config per tenant (overrides PLATFORM_NAME in UI)

Never hardcode the brand name in code. Always read from env.

## Branch Strategy (Solo Dev)

```
main      ← protected, CI must pass, no direct push
dev       ← integration branch — never push feature work directly here
prod      ← auto-managed by CI only (tags + deployment record)
feature/* ← REQUIRED for every new module, fix, or update
hotfix/*  ← emergency only, fast-track to main + dev
```

**Every change gets its own feature branch.** No exceptions.

```
# correct flow
git checkout -b feature/rrb-group-d-marking-fix
# ... work ...
git push origin feature/rrb-group-d-marking-fix
# PR → dev → CI passes → merge → delete branch

# correct flow for new module
git checkout -b feature/rrb-ntpc-module
```

**Flow:** feature/* → PR → CI passes → merge to dev → PR → merge to main → tag → prod deploy

**No GitFlow.** No qa branch. No release branches. CI is the gatekeeper.

## Branch Protection Rules

| Branch | Direct push | Merge from | CI required | Force push |
|---|---|---|---|---|
| main | blocked | dev only | yes | never |
| dev | allowed | feature/*, hotfix/* | no (fast feedback only) | never |
| prod | blocked | main only (CI) | yes | never |

## Merge Validation

Every PR from dev → main triggers:
1. Lint + type check
2. Unit tests (marking engine, timer, state manager)
3. Integration test (full exam flow simulation)
4. CF Workers preview deploy (live URL to test manually)
5. Merge queue (re-tests against latest main before merge)

All must pass. One failure = merge blocked.

## CI/CD Per Module

```
Push to modules/rrb-ntpc/ only:
  ✓ ci-rrb-ntpc.yml     RUNS
  ✓ ci-ssc-cgl.yml      SKIPPED
  ✓ ci-banking.yml      SKIPPED

Push to packages/shared-lib/:
  ✓ ci-shared-lib.yml   RUNS
  ✓ ALL module CIs      RUN (dependency graph)
```

## CODEOWNERS

```
*                    @sravan           ← default owner (solo)
/packages/shared-lib/ @sravan
/modules/rrb-*/      @sravan
/docs/               @sravan
/memory/             @sravan
```

Update when contractors/team join — assign specific module ownership.

## Backup Repo

- Mirror to: `mock-test-platform-backup` org on GitHub
- Sync: GitHub Action on every push to main (< 60 sec lag)
- Rule: backup is read-only. Never push to backup directly.

## Secrets Management

- Never committed to repo
- `.env.example` committed (template, no real values)
- Real secrets: CF Workers wrangler secrets + AWS Parameter Store + GitHub Secrets (CI)
- `.env.dev` and `.env.prod` in `.gitignore`

## ADR (Architecture Decision Records)

Every major decision documented in `docs/adr/`:
- Format: Context → Decision → Consequences → Alternatives considered
- Purpose: new team members understand why, not just what
