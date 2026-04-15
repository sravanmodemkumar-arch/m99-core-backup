# Platform Architecture

## Core Philosophy

**Stub now, activate on signal.**
The structure is final from day one. Implementations activate when traffic demands them.
No rewrites — every evolution is: flip flag + fill stub.

---

## System Overview (v1)

```
                    ┌──────────────────────────────────────┐
                    │  DNS                                  │
                    │  *.m99-core.com  → Cloudflare         │
                    │  test.allen.ac.in → CNAME → CF        │
                    └─────────────────┬────────────────────┘
                                      │
                    ┌─────────────────▼────────────────────┐
                    │  platform/gateway  (CF Worker)        │
                    │  hostname → KV lookup → tenant_id     │
                    │  path    → route to module worker     │
                    └──────┬───────────────┬───────────────┘
                           │               │
              ┌────────────▼──┐     ┌──────▼──────────────┐
              │ modules/auth  │     │ modules/rrb-group-d  │
              │ CF Worker     │     │ CF Worker            │
              │ OTP · JWT     │     │ exam API + fe/       │
              └───────────────┘     └──────────┬───────────┘
                                               │
                              ┌────────────────▼────────────┐
                              │  CF KV + R2                  │
                              │  routing · flags · bundles   │
                              │  TSF sessions · content      │
                              └────────────────┬─────────────┘
                                               │
                              ┌────────────────▼────────────┐
                              │  platform/lambda  (AWS)      │
                              │  TPS · BS · EPS  (v1 active) │
                              │  TGM · TMS · CGS (stubs)     │
                              └────────────────┬─────────────┘
                                               │
                              ┌────────────────▼────────────┐
                              │  AWS RDS PostgreSQL (v1)     │
                              │  global  : tenants · exams   │
                              │  tenant_allen  : results …   │
                              │  tenant_fiitjee: results …   │
                              └─────────────────────────────┘
```

---

## Domain Routing

```
allen.m99-core.com
  → gateway reads host
  → KV get("slug:allen") → "T001"
  → route to auth or exam module worker

test.allen.ac.in  (custom domain — CF for SaaS)
  → Cloudflare resolves via custom hostname registration
  → KV get("domain:test.allen.ac.in") → "T001"
  → same flow
```

**Adding a custom domain:**
1. Tenant enters domain in admin panel
2. Platform calls CF API → adds custom hostname → CF issues SSL cert automatically
3. Platform writes `domain:{host}` → tenant_id to KV
4. Tenant adds CNAME: `test.allen.ac.in CNAME allen.m99-core.com`
5. Live in ~5 minutes, zero manual SSL work

---

## Auth + Navigation

```
modules/auth/
  backend/          OTP login, JWT issue/verify, module access list
  fe/web/           login page + home/switcher (HTMX)
  fe/mobile/        LoginScreen + HomeScreen (React Native)

modules/app-shell/
  mobile/App.js     Composition root — ONLY file that imports across modules
                    Registers: LoginScreen, HomeScreen (from auth)
                               ExamScreen, ResultScreen (from each exam module)
```

**After login:**
- 1 subscribed module → redirect directly to that module
- 2+ modules → HomeScreen switcher
- 0 modules → "No active subscription"

---

## Exam Session Data Flow

```
1. Open allen.m99-core.com
   → gateway → auth → login page

2. OTP login
   → auth CF Worker → JWT issued (tenant_id + uid)
   → fetch module list from KV → show switcher or redirect

3. Start exam
   → exam CF Worker → build TSF → store in KV (48h TTL)
   → serve fe/web/ or mobile ExamScreen
   → client downloads bundle from R2 (all questions + answer key)

4. During exam
   → answers saved locally (IndexedDB / expo-sqlite)
   → fire-and-forget POST to CF Worker for server-side TSF sync
   → CF Worker updates TSF in KV

5. Submit
   → client computes score instantly from bundle answer key
   → result shown immediately — zero server wait
   → result queued locally for batch sync

6. Batch sync  (4 results OR 24h trigger)
   → client POSTs batch to CF Worker
   → Worker writes locked batch file to ECDN R2
   → EPS Lambda: picks up → validates attempt_no → writes to tenant PG
   → deletes locked file only after confirmed PG write [!]

7. Weakness analytics  (v2.5 — CGS stub in v1)
   → CGS triggered by EPS after confirmed write
   → computes subtopic accuracy map
   → writes to tenant PG + pushes to CCDN R2
```

---

## Database Design

### v1 Setup
- **Single RDS PostgreSQL instance** — no multi-instance, no proxy in v1
- **Schema-per-tenant** — `tenant_{slug}` naming (e.g. `tenant_allen`)
- **Global schema** — `tenants`, `questions`, `exams`, `subjects`
- **No RDS Proxy** — add when Lambda concurrency > 10 and connection errors appear
- **Lambda connection** — `pool_size=1, max_overflow=0` — one connection per invocation

### Schema Naming Rule
```
tenant_allen      ← readable in pg_dump, psql, CloudWatch logs
tenant_fiitjee
tenant_narayana
```
- Slug-based, not UUID — readable everywhere
- Set at provisioning (TPS), never changed
- Stored in global `tenants` table as source of truth

### Global Tenants Table
```sql
CREATE TABLE tenants (
  tenant_id   UUID        PRIMARY KEY,
  slug        VARCHAR     UNIQUE NOT NULL,    -- "allen"
  schema_name VARCHAR     NOT NULL,           -- "tenant_allen"
  pg_host     VARCHAR     NOT NULL,           -- resolved per invocation
  tier        VARCHAR     NOT NULL DEFAULT 'T1',
  modules     JSONB       NOT NULL DEFAULT '[]',
  theme       JSONB       NOT NULL DEFAULT '{}',
  created_at  BIGINT      NOT NULL
);
```
- TPS writes here first → then syncs to KV
- KV is a cache. This table is the source of truth.
- If KV is wiped: rebuild from this table in seconds.

### All Tenant Tables Include tenant_id
Every table in every tenant schema carries `tenant_id UUID NOT NULL`.
**Why:** Zero-cost insurance. When migrating from schema-per-tenant to
shared-DB-with-tenant_id at scale, no `ALTER TABLE` needed — column already exists.

### Table Rules
```
results         → append-only. PK: (uid, qid, attempt_no). Never UPDATE.
attempt_no      → validated server-side: must = current_max + 1 [!]
questions       → stored in R2. DB holds qid reference only.
writes          → batch inserts, never row-by-row
cross-tenant    → never. One session = one tenant schema.
indexes v1      → uid, qid, attempt_no, timestamp only
```

### Connection Rules
```python
# Lambda: single connection per invocation — no pooling
engine = create_engine(
    url,
    pool_size=1,
    max_overflow=0,
    pool_pre_ping=True,
)
```
```
max_connections = 100   (RDS parameter group)
pg_host         = resolved dynamically from global tenants table — never hardcoded
```

### Monitoring (from day 1)
```
postgresql.conf:  log_min_duration_statement = 100   (log queries > 100ms)
CloudWatch:       Connections · FreeableMemory · CPUUtilization · ReadIOPS · WriteIOPS
```

### Backup Per Tenant
```bash
pg_dump -n tenant_allen mocktest > allen_$(date +%Y%m%d).sql
```
Schema isolation makes per-tenant backup clean and fast.

### DB Evolution Path
```
v1   → single RDS, schema-per-tenant, no proxy
        ↓ Lambda concurrency > 10 + connection errors
v2   → add RDS Proxy
        ↓ 50+ tenants, Alembic across schemas becomes slow
v2.5 → schema groups (batch tenants per instance)
        ↓ approaching schema count limits (~1000+)
v3   → shared DB with tenant_id (column already on all tables from v1)
        ↓ read load signal
v3.5 → read replicas per region
```

---

## Module Independence

Each exam module:
- Has its own CF Worker — `wrangler deploy` ships everything
- Has its own config, frontend, tests
- Knows nothing about other modules
- Consumes platform services (BS, EPS) — never owns them

---

## Feature Flag System

All dormant features controlled by KV flags — no deploy to activate.

```
flag:tgm_active    = "false"    → activate at 20 tenants / 50k users
flag:tms_active    = "false"    → activate on first migration need
flag:cgs_active    = "false"    → activate at 1000 submissions/day
flag:rds_proxy     = "false"    → activate when connection errors appear
flag:multi_region  = "false"    → activate at 500 tenants / latency signal
flag:batch_size    = "4"        → tune without code change
flag:flush_hours   = "24"       → tune without code change
```

---

## Stable Contracts (set in v1, never change)

| Contract | Notes |
|---|---|
| TSF JSON schema | Server↔client exam session contract |
| KV key format | `slug:` `domain:` `tenant:` `flag:` `tsf:` `idem:` |
| Module API routes | `/config` `/session` `/start` `/answer` `/flag` `/submit` `/result` |
| Batch result format | `{ test_id, module_id, score, correct, wrong, unattempted, answers, submitted_at }` |
| QID format | `SUBJ-topic-subtopic-type-difficulty-cat-000001` (7 parts) |
| 5 question states | not_visited · not_answered · answered · marked_review · answered_marked |
| Schema naming | `tenant_{slug}` — never changes after provisioning |

---

## Evolution Path

```
v1   → 5–10 tenants · 1 region · TPS + BS + EPS active
        ↓ 20 tenants OR 50k users
v1.5 → TGM activates

        ↓ first migration need
v2   → TMS activates · RDS Proxy added

        ↓ 1000+ submissions/day
v2.5 → CGS activates (weakness analytics)

        ↓ 500+ tenants OR SEA latency
v3   → multi-region gateway · second RDS region

        ↓ real-time feature demand
v3.5 → Durable Objects (live proctoring / leaderboards)
```

No rewrites at any step. Every activation = flip KV flag + fill stub.
