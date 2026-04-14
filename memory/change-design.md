---
name: Design for Change
description: What changes vs what is locked — volatile things in config, stable things in code
type: project
---

## Core Principle

```
Everything that CHANGES  →  lives in config / DB / KV / feature flags
Everything that's STABLE →  lives in code

Code change = deploy risk
Config change = zero risk, zero deploy
```

## What Will Change — Guaranteed

### Exam Patterns (Most Volatile)
Exam boards change Q count, sections, marking every 1-2 years.
- Pattern lives in DB → module reads pattern_id from DB → update DB = instant change, zero deploy
- Old tests keep old pattern version, new tests get new pattern
- Pattern versioning: pattern_id is immutable once used

### Question Types Will Expand
- Use plugin registry — not if/else in renderer
- New type = new plugin file + register = zero changes to existing code

### Infrastructure Provider
- All infra behind provider adapters (storage, cache, queue)
- Business logic calls `storage.put()` not `R2.put()` directly
- Switch provider = swap adapter only

### Regulations (DPDP, exam board rules)
- Compliance as separate module, not embedded in business logic
- Regulation changes = update compliance module only

### Tenant Business Model
- Pricing logic in entitlements system, not in module code
- `entitlement.canAccess(tenant_id, module_id, feature)`
- Pricing changes = update entitlement rules, zero module code change

### Team Structure
- CODEOWNERS handles assignment
- ADRs document all decisions for new team members

### Shared-Lib Breaking Changes
- Modules pin to specific semver version
- Breaking change = major version bump, modules migrate on own timeline
- Both versions supported during 3-month transition

### Mobile App
- TSF schema changes are additive only (never remove fields)
- `min_app_version` in TSF controls compatibility
- Checked on exam load, never mid-exam

## What Must NEVER Change (Lock Now)

These are hardest to migrate. Get right once.

| Thing | Why it cannot change |
|---|---|
| QID format | Every question in DB, R2, code references this |
| Tenant ID format | Embedded in JWT, KV, DB, logs, audit trail |
| TSF core schema fields | Millions of stored test sessions |
| Event schema core | Append-only, old events unreadable if format changes |
| Auth token structure | Every client depends on this |

## Applied Mapping

| Concern | Lives in | Change mechanism |
|---|---|---|
| Exam pattern | DB (pattern table) | DB update |
| Tenant name/theme | KV (tenant config) | KV write |
| Feature on/off | Feature flag (KV) | KV write |
| Marking scheme | TSF config (per exam) | New TSF version |
| Question type rendering | Plugin registry | New plugin file |
| Infrastructure | Provider adapters | Swap adapter class |
| Business rules | Code | PR + deploy |
| API contracts | Versioned endpoints | New version, keep old |
| Compliance rules | Compliance module | Update compliance only |
| Access control | Entitlements module | Update rules only |

## Data Migration Rules

Every data migration must be:
- **Reversible** — has a `down()` function
- **Idempotent** — safe to run twice, same result
- **Tested** — on staging with production data volume
- **Windowed** — only during 2am–4am IST (off-peak)
- **Monitored** — Grafana alert if exceeds expected time
- **Non-locking** — never lock tables (use concurrent patterns)
- **Snapshotted** — DB snapshot taken before every migration

## Feature Flag System

```javascript
// KV-based, zero deploy to toggle
flag:rrb-ntpc-v2-ui  → { enabled: false }   // in code but off
flag:rrb-ntpc-v2-ui  → { enabled: true }    // turn on without deploy

// Per-tenant flags
flag:allen:rrb-ntpc-v2-ui → { enabled: true }  // only ALLEN gets new UI
```

## ADR (Architecture Decision Records)

Location: `docs/adr/`

Format for every major decision:
```markdown
# ADR-001: Turborepo Monorepo

## Context
Why this decision was needed

## Decision
What was chosen

## Consequences
What this means going forward

## Alternatives Considered
What was rejected and why
```

New team member reads ADRs → understands system in hours not weeks.
