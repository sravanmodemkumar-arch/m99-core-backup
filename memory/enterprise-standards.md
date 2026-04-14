---
name: Enterprise Standards
description: All enterprise-grade requirements — security, compliance, observability, integrity, incidents
type: project
---

## Priority Order

| Priority | Standard | Status |
|---|---|---|
| P0 | Idempotency (exam submit) | implement first |
| P0 | Secret scanning (GitHub) | enable on repo creation |
| P0 | DPDP Act 2023 compliance | legal requirement |
| P1 | API versioning | from day 1 |
| P1 | Audit logging | append-only, 7yr retention |
| P1 | RBAC | see tenant-architecture.md |
| P1 | Anti-cheat / test integrity | platform credibility |
| P2 | OpenTelemetry tracing | debugging at scale |
| P2 | SLO definition | measure health |
| P2 | Load testing (k6) | pre-exam validation |
| P2 | Zero-downtime migrations | safe deploys |
| P3 | Incident runbooks | fast recovery |
| P3 | Mobile version compatibility | safe upgrades |

## Idempotency — Exam Submit

```
Every submit carries idempotency key: X-Idempotency-Key: TST-XXXX-SUBMIT-001
Server stores key → if seen again → return cached response, ignore duplicate
Prevents double submission on network retry (common in India mobile networks)
```

## API Versioning

```
All APIs versioned from day 1:
  /v1/exam/submit
  /v2/exam/submit    ← new format, v1 still works

Deprecation policy: old version supported 6 months after new version ships
Never break a client without 6 months notice
```

## DPDP Act 2023 (India)

Requirements:
- Explicit consent before student data collection
- Right to erasure: delete within 72 hours of request
- Data breach notification: notify within 72 hours of discovery
- Data minimization: collect only what's needed
- Purpose limitation: exam data used only for exam, not marketing

Implementation:
```
compliance.checkConsent(user_id, purpose)
compliance.scheduleErasure(user_id, deadline)
compliance.logBreach(incident_id, affected_count)
```

## Audit Logging

```json
{
  "actor_id": "admin-001",
  "action": "QUESTION_MODIFIED",
  "resource": "MATH-03-02-S-M-C-000123",
  "old_val": { "difficulty": "M" },
  "new_val": { "difficulty": "H" },
  "ip": "1.2.3.4",
  "timestamp": "ISO"
}
```

- Append-only table (no UPDATE/DELETE allowed)
- Retention: 7 years
- Every admin action logged: question edit, exam create, tenant config change, student data access

## Security Pipeline

```
Dependabot        → auto PRs for vulnerable npm packages
Secret scanning   → GitHub blocks commits with leaked tokens
CodeQL (SAST)     → static code analysis on every PR
npm audit         → runs on every CI build
CSP headers       → prevents XSS on web client
Rate limiting     → per IP + per user (CF native, free)
JWT rotation      → tokens expire, refresh token flow
```

## Anti-Cheat / Test Integrity

```
Tab switch detection    → warn on 1st, auto-submit on 3rd
Copy-paste prevention   → disabled in question panel
Right-click disabled    → on exam UI
Fullscreen enforcement  → exit = warning modal
DevTools detection      → keyboard shortcut blocking
IP anomaly              → same exam from 2 IPs simultaneously = flag
Time anomaly            → submit in 30s for 100Q = flag for review
Watermark               → candidate name + roll no on every screen (screenshot deterrent)
```

## Observability — OpenTelemetry

```
Every request gets trace_id
Shell Worker → Module Worker → Lambda → DB → R2
All linked by same trace_id
Grafana Tempo shows full journey with timing per step

Without this: student reports slow exam → no idea where bottleneck is
With this: exact step and duration visible
```

Stack: Prometheus (metrics) + Loki (logs) + Grafana Tempo (traces) + Alertmanager

## SLO Targets

```
Exam availability         : 99.9% (8.7 hours downtime/year)
Submit latency p99        : < 3 seconds
Score display p99         : < 5 seconds after submit
Bundle delivery p99       : < 2 seconds
Error budget              : 0.1% = 43 minutes/month
```

When error budget depleted → freeze all non-critical deploys.

## Zero-Downtime DB Migrations

```
Expand-Contract pattern:
  Phase 1 (expand)   → add new column, keep old column, both work
  Phase 2 (migrate)  → backfill new column
  Phase 3 (contract) → remove old column after all code uses new

Rules:
  Never lock a table (use concurrent index creation)
  Migration window: 2am–4am IST only
  Every migration: reversible (has down()), idempotent (safe to run twice)
  Tested on staging with prod-volume data before running on prod
  Monitored: Grafana alert if migration exceeds expected time
```

## Load Testing

```
Tool: k6 (open source, free)
When: before every major exam date (RRB notification → 10L students attempt same day)
Test: 10,000 concurrent exam sessions
Validate: PgBouncer pool, R2 read throughput, DO batch writer, CF Worker limits
Gate: if p99 latency > 3s → do NOT release
```

## Incident Management

```
P1 (exam down during live session)   → fix in 15 min, notify students immediately
P2 (module crash, <10% affected)     → fix in 1 hour
P3 (slow performance)                → fix in 4 hours
P4 (non-critical bug)                → next release

Runbook example — "rrb_ntpc_module_up = 0":
  1. Check CF Workers dashboard
  2. Check last deploy — was canary enabled?
  3. Rollback: set canary_pct = 0 in KV
  4. If still down: check wrangler deploy logs
  5. If not resolved in 10 min: full rollback to stable version
```

## Mobile Version Compatibility

```
TSF records minimum app version:
  "min_app_version": "1.3.0"

App checks on exam load (not mid-exam):
  if app_version < min_app_version → "Please update app to take this exam"

TSF schema changes are additive only:
  Never remove a field from TSF
  Deprecate and keep — old apps still parse correctly
```

## Data Retention Policy

```
Exam attempt data     → 5 years
Student profile       → until erasure request
Audit logs            → 7 years
Event logs            → 30 days hot, 90 days warm, archive after
Question content      → indefinite
```
