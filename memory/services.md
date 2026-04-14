# Services

## CF Workers (JavaScript) — Edge, Zero Cold Start

| Service | Endpoints | Key Logic |
|---|---|---|
| AS (Auth) | POST /v1/auth/login, GET /v1/auth/validate | Login + JWT; embeds UID+TID+GID+enc_secret; KV tenant resolution |
| SS (Settings) | GET /v1/settings, PATCH /v1/settings | 3-update lifetime limit server-side [!]; pA recalc on overwrite; returns remaining count |
| EIS + DO (Event Ingestion) | POST /v1/events | Validate → pA → P0–P7 → DO → R2; DO writes immediately on arrival [!] |
| BAS (Bundle Access) | GET /v1/bundle, POST /v1/bundle/swap | JWT + enrollment check; signed R2 URL; swap deferred until session ends [!] |

## AWS Lambda (Python) — 15-min max, 2 regions

| Service | Trigger | Key Logic |
|---|---|---|
| EPS (Event Processing) | 5-min/30-min poll + 3–7AM IST + threshold | Poll ECDN; chunk 100; checkpoint to tenant PG via RDS Proxy; trigger CGS after confirmed write [!] |
| CGS (Content Gen) | EPS only, after confirmed DB write [!] | JOIN tenant.results + global.questions; compute WS rollup; push to CCDN R2 |
| BS (Bundle Svc) | Notification-driven (exam) / monthly (subject) | Read global.questions; build bundles; SHA-256 manifest; QID on every question [!] |
| TPS (Tenant Provisioning) | On-demand admin | Tenant PG schema → Alembic migrations → R2 folders → KV → enc_secret; pull from WP |
| TGM (Tenant Growth Monitor) | Daily 2AM IST | Composite trigger (2 of 3); 5/7 rolling window; promote/demote/extract |
| TMS (Tenant Migration) | Triggered by TGM | 5-phase: provision → DW activate → backfill → verify (PG row count+checksum) → cutover |

## New Tenant Provisioning Flow (fully automated)

Admin inputs: TID + GID + bundle_strategy + exam_subject_config  
→ TPS Lambda:  
→ provision PG schema  
→ Alembic migrations  
→ register KV  
→ create R2 folders (ECDN + CCDN)  
→ generate enc_secret  
→ deploy initial bundle

## Routing

KV stores: tenant → RDS host + schema + group (edge-cached).  
Every CF Worker request: JWT → KV lookup → tenant PG via RDS Proxy.  
CF Workers never touch global schema [!].
