# Tenant Rules + Groups + Migration

## Core Tenant Rules

- Every tenant table namespaced by TID
- TID + GID embedded in every JWT
- No cross-tenant queries ever
- Routing: KV edge-cached → PG host + schema + group via RDS Proxy
- GID always set by admin at provisioning only [!]; system never auto-assigns
- 1 tenant schema failure → only that tenant affected (full isolation)

## Groups (GID)

- Admin sets GID by org/exam/geography affinity at provisioning
- All tenants in a group share a PG instance via RDS Proxy
- All group tenants enter + exit DW (dual-write) simultaneously [!]
- Partial group migration never allowed [!]

## Tenant Growth Monitor (TGM)

- Runs daily at 2AM IST
- Composite trigger: **2 of 3** conditions must be true over **5/7 rolling days**:
  1. user_count crosses tier threshold
  2. avg_write_latency > 300ms
  3. peak_connection_wait > 100ms
- Diverging tenant (3× above group avg for 5/7 days) → extraction via TMS

## Tenant Migration (TMS) — 5 Phases

```
1. Provision    → create new PG schema / instance in target tier
2. DW activate  → enable dual-write to both old and new (all group tenants simultaneously) [!]
3. Backfill     → copy historical data to new location
4. Verify       → PG row count + checksum comparison
5. Cutover      → switch live traffic; retire old
```

DW overhead alert fires if DW phase > 48h.

## New Tenant Provisioning (TPS) — Fully Automated

Admin inputs: `TID + GID + bundle_strategy + exam_subject_config`

TPS Lambda steps:
1. Pull from Warm Pool (WP)
2. Provision PG schema
3. Run Alembic migrations
4. Create R2 folders (ECDN + CCDN)
5. Register routing in KV
6. Generate enc_secret → store in tenant PG + Secrets Manager
7. Deploy initial bundle

Zero code changes required for new tenants.

## Warm Pool (WP)

Always pre-provisioned:
- 3 × T1 instances
- 2 × T2 instances
- 1 × T3 instance

Auto-refills on consumption. WP below minimum = **critical alert**.

## DB Tier Rules

| Tier | Users/tenant | Tenants/instance | RDS Proxy |
|---|---|---|---|
| T1 | 0–1L | 10 | 1 proxy/instance |
| T2 | 1L–2.5L | 3–5 | 1 proxy/instance |
| T3 | 2.5L+ | 2–3 | 1 proxy/instance |

**Promotion:** 5/7 rolling window, composite trigger (2 of 3)  
**Demotion:** 1st of month only; below lower threshold for 30 consecutive days
