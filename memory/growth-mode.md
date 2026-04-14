# Growth Mode — Phased Infrastructure

## Philosophy
Build only what the current phase needs.
Upgrade on measurable triggers, not guesses.
Every phase uses the same codebase — only infra config changes.

---

## Phase 0 — Bootstrap
`0–5 tenants | 0–10k users | ~₹0/month`

### What's active
| Layer | Tool | Notes |
|---|---|---|
| Edge | CF Workers free tier | 100k req/day |
| Edge storage | CF R2 free | 10 GB |
| Edge KV | CF KV free | 100k reads/day |
| Edge DO | CF Durable Objects free | 100k req/day |
| Compute | AWS Lambda free tier | 1M req/month |
| DB | 1× RDS db.t3.micro (free 12 months) | Global schema + all tenants on 1 instance, no tier split yet |
| Connection pooler | 1× PgBouncer on EC2 t3.micro (free 12 months) | Single pooler for all connections |
| Secrets | AWS Parameter Store Standard | Free up to 10k params |
| Monitoring | CF Analytics + Lambda CloudWatch basic | Free, no dedicated server yet |
| CI/CD | GitHub Actions | Free |
| Dev DB | Neon free tier | Branch per PR |
| Tenant provisioning | Manual via TPS Lambda | No warm pool |
| Migration | None — TGM/TMS not deployed | Manual if needed |

### What is NOT built yet
- Tier split (T1/T2/T3) — all tenants share 1 RDS instance
- Warm pool
- TGM / TMS
- Dedicated monitoring EC2
- PgBouncer per tier (single pooler serves all)

### Cost
```
RDS db.t3.micro      → free (12 months)
EC2 t3.micro         → free (12 months)
CF Workers           → free tier
Lambda               → free tier
Parameter Store      → free
Total                → ~₹0/month
```

### Upgrade trigger → Phase 1
- 5th tenant added, OR
- RDS CPU > 70% sustained for 3 days, OR
- CF Workers hitting 80k req/day (80% of free limit)

---

## Phase 1 — Early Growth
`5–50 tenants | 10k–200k users | ~₹8k–25k/month`

### What changes from Phase 0
| Layer | Change |
|---|---|
| CF Workers | Upgrade to paid plan ($5/mo = ₹415/mo) |
| RDS | Split into: 1× global instance + T1 pool (2–5 db.t3.small instances) |
| PgBouncer | Move to ECS Fargate container (1 container for T1 pool) |
| Monitoring | Grafana + Loki on 1× EC2 t3.micro (₹600/mo) |
| Warm pool | 1× T1 instance pre-provisioned |
| TPS | Automated (pulls from warm pool) |

### What stays the same
- TGM / TMS: not yet deployed (manual tier change if needed)
- T2 / T3: not active
- Neon for dev/staging

### Infrastructure layout
```
Lambda → PgBouncer (ECS Fargate) → T1 RDS pool (2–5 instances)
                                  → Global RDS (1 instance)
CF Workers → CF KV → PgBouncer (via internal endpoint)
```

### Cost estimate
```
CF Workers paid          ₹415/mo
RDS db.t3.small × 3     ₹7,500/mo
ECS Fargate (PgBouncer)  ₹500/mo
EC2 t3.micro (Grafana)   ₹600/mo
Parameter Store           ₹50/mo
Lambda (above free)       ₹0–500/mo
Total                    ~₹9k–10k/mo
```

### Upgrade trigger → Phase 2
- 50th tenant added, OR
- Any T1 RDS instance > 80k users, OR
- PgBouncer connection wait > 50ms sustained

---

## Phase 2 — Growth
`50–200 tenants | 200k–2M users | ~₹50k–150k/month`

### What changes from Phase 1
| Layer | Change |
|---|---|
| RDS tiers | T1 pool grows + T2 pool activated (db.t3.medium, 3–5 instances) |
| PgBouncer | 1 ECS Fargate container per tier (T1 + T2) |
| Warm pool | 3× T1 + 1× T2 pre-provisioned |
| TGM | Deployed — runs daily 2AM IST, auto-flags tenants for promotion |
| TMS | Semi-automated — TGM flags, human approves, TMS executes |
| Monitoring | Full stack: Grafana + Prometheus + Loki + Alertmanager on t3.small |
| Infisical | Deployed for team secret management |

### Infrastructure layout
```
Lambda → PgBouncer T1 (ECS) → T1 RDS pool (10–20 instances)
       → PgBouncer T2 (ECS) → T2 RDS pool (3–5 instances)
       → Global RDS proxy    → Global RDS (1 instance)

TGM (daily) → flags diverging tenants → human approves → TMS executes
```

### Cost estimate
```
CF Workers paid             ₹415/mo
RDS T1 × 10 (db.t3.small)  ₹25,000/mo
RDS T2 × 3 (db.t3.medium)  ₹12,000/mo
RDS Global (db.t3.small)   ₹2,500/mo
ECS Fargate × 2 (PgBouncer) ₹1,500/mo
EC2 t3.small (monitoring)   ₹1,200/mo
Lambda                      ₹2,000/mo
Warm pool (4 instances)     ₹12,000/mo
Total                       ~₹56k–60k/mo
```

### Upgrade trigger → Phase 3
- 200th tenant added, OR
- T2 instances > 3, OR
- TMS running > 3 migrations/week (automation needed)

---

## Phase 3 — Scale
`200–2000 tenants | 2M–20Cr users | ₹2L+/month`

### What changes from Phase 2
| Layer | Change |
|---|---|
| RDS tiers | T1 + T2 + T3 all active (full spec architecture) |
| PgBouncer | 1 ECS Fargate cluster per tier (T1, T2, T3) — auto-scaled |
| Warm pool | Full spec: 3× T1 + 2× T2 + 1× T3, auto-refills |
| TGM | Fully automated — no human approval |
| TMS | Fully automated — 5-phase migration runs on trigger |
| Monitoring | Multi-instance monitoring, alert tiers: Critical/Warning/Info |
| Global RDS | Upgrade to db.r6g.large for read performance |

### Full architecture as specced
```
Lambda → PgBouncer T1 cluster → T1 pool (~200 instances max)
       → PgBouncer T2 cluster → T2 pool (~50 instances)
       → PgBouncer T3 cluster → T3 pool (~20 instances)
       → Global PgBouncer     → Global RDS (1 instance, r6g.large)

TGM (daily 2AM IST)
  → 2/3 composite trigger over 5/7 rolling days [!]
  → auto-invokes TMS

TMS 5-phase:
  provision → DW activate (all group tenants simultaneously [!])
  → backfill → verify (row count + checksum)
  → cutover → retire old
```

---

## Phase Comparison

| | P0 Bootstrap | P1 Early | P2 Growth | P3 Scale |
|---|---|---|---|---|
| Tenants | 0–5 | 5–50 | 50–200 | 200–2000 |
| Users | 0–10k | 10k–200k | 200k–2M | 2M–20Cr |
| RDS instances | 1 | 3–6 | 15–25 | 100–270 |
| PgBouncer | 1 EC2 | 1 ECS (T1) | 2 ECS (T1+T2) | 3 ECS clusters |
| Warm pool | None | 1× T1 | 3×T1 + 1×T2 | 3×T1 + 2×T2 + 1×T3 |
| TGM/TMS | Not deployed | Not deployed | Semi-auto | Fully automated |
| Monitoring | CF + CloudWatch | Grafana + Loki | Full stack | Multi-instance |
| Cost/month | ~₹0 | ~₹9–10k | ~₹56–60k | ₹2L+ |

---

## Upgrade Rules

- Never skip a phase — each phase's infra must be stable before moving up
- Upgrade is triggered by **metrics, not calendar**
- Downgrade (P2 → P1) allowed on 1st of month only if below threshold for 30 days
- Warm pool must be refilled within 24h of consumption [!]
- Phase 0 → P1 upgrade: run `scripts/upgrade-phase.sh p0-to-p1`
- Config changes only — codebase does not change between phases

---

## What Never Changes (across all phases)

- QID format and all [!] non-negotiable rules
- AES-GCM encryption logic
- Sync queue behavior
- Event batching P0–P7
- Alembic migration structure
- CF Workers service logic (AS, SS, EIS, BAS)
- Lambda handler logic (EPS, CGS, BS, TPS, TGM, TMS)
