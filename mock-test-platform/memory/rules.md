# Hard Rules — Never Break

## Cross-Module Boundaries
- `app-shell/mobile/App.js` is the ONLY file allowed to import across module boundaries
- Modules NEVER import from each other
- Modules NEVER import from platform/
- Platform lambdas serve ALL modules — never duplicated per module

## Auth Module
- `modules/auth/` — identity only: OTP, JWT, module access list
- Auth knows NOTHING about exam modules
- After login: 1 module → redirect direct; 2+ → HomeScreen switcher; 0 → "No active subscription"

## Exam Module Config
- `backend/config.js` is the ONLY source of truth for exam pattern
- Pattern change = update `config.js` only — zero other code changes
- `wrong: 1/3` exact fraction — NEVER `0.33` or rounded equivalent

## Scoring
- `marking.js` (server) and `fe/shared/scoring.js` (client) must produce IDENTICAL results
- Full float precision — NO Math.round mid-calculation
- Display only: `score.toFixed(2)` — but only at display layer, never in calculation

## CF Workers
- CF Workers NEVER touch RDS directly
- CF Workers use KV + R2 ONLY
- Only Lambda touches RDS

## Database
- Results: append-only. INSERT only, NEVER UPDATE. PK: (uid, qid, attempt_no)
- attempt_no validated server-side: must = current_max + 1
- Questions/content stored in R2 — DB holds qid reference only
- Cross-tenant queries: NEVER (design error if needed)
- Batch inserts, not row-by-row
- pg_host: NEVER hardcoded — always resolved dynamically from global tenants table

## KV
- KV is a cache — never source of truth for mutable user data
- Source of truth for tenant routing: global tenants table in RDS
- If KV wiped: rebuild from tenants table

## Schema Naming
- Always `tenant_{slug}` — never UUID-based
- Set at provisioning (TPS), NEVER changed after

## Mobile Navigation
- Screen names: `{ModuleId}Exam`, `{ModuleId}Result`
- Registered ONLY in `app-shell/mobile/App.js`

## Frontend Imports (within a module)
- Web: `import '/shared/scoring.js'` (absolute URL — CF serves `/shared/` from `./fe/shared/`)
- Mobile: `import '../shared/scoring.js'` (relative file path)
- Desktop: same as mobile

## Batch Sync
- Queue results locally first (IndexedDB / expo-sqlite)
- Flush trigger: 4 results accumulated OR 24h since last flush
- Check: every page load (web), every app foreground (mobile)

## Wrangler Assets
- `assets = "./fe"` in wrangler.toml — CF serves entire fe/ folder
- Web pages at `/web/`, shared JS at `/shared/`
- Worker handles: `GET /` → redirect to `/web/index.html`

## Idempotency
- EPS Lambda validates attempt_no before every write
- Locked batch files in R2 deleted ONLY after confirmed PG write
- Idempotency keys stored in KV with TTL

## What NEVER Changes After v1 Ships
- TSF JSON schema
- KV key format
- Module API routes
- Batch result format
- QID format (7 parts: SUBJ-topic-subtopic-type-difficulty-cat-seq)
- 5 question state names and their meaning
- Schema naming convention `tenant_{slug}`
