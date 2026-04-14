---
name: Repository Architecture
description: Monorepo structure, branch strategy, repo naming, CI/CD pipeline decisions
type: project
---

## Repo Structure — Turborepo Monorepo

Single repo. Each module acts independently via Turborepo tooling.

```
m99-core/
  ├── packages/
  │   └── shared-lib/         ← core library, versioned independently
  ├── modules/
  │   ├── rrb-group-d/        ← JSON API + business logic ONLY (no UI)
  │   ├── rrb-ntpc/           ← own package.json, own CI, own CF Worker
  │   ├── ssc-cgl/
  │   └── ... (50+ modules)
  ├── apps/
  │   ├── web/                ← ONE browser app for ALL exam modules
  │   ├── mobile/             ← ONE React Native app (phone + tablet)
  │   └── desktop/            ← ONE desktop app (v2, later)
  ├── memory/
  ├── docs/
  ├── turbo.json
  └── .github/workflows/      ← per-module CI workflows
```

**Why Turborepo:** Only rebuilds/tests affected modules. PR touching rrb-ntpc → only rrb-ntpc CI runs. shared-lib change → all module CIs run (dependency graph).

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
