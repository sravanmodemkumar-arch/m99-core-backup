# Exam Module — Structure, Rules & Evolution

Every exam (RRB Group D, SSC CGL, RRB NTPC, etc.) is an independent module under `modules/`.
Each module is a complete, independently deployable project. `wrangler deploy` from the module folder ships everything.

---

## Folder Structure

```
modules/{module-id}/
├── backend/                   ← Cloudflare Worker (edge compute + API + static assets)
│   ├── worker.js              ← entry point: 8 routes + error boundary
│   ├── config.js              ← exam pattern (sections, marking, schedule) — ONLY source of truth
│   ├── tsf.js                 ← Test Session File builder + state machine
│   ├── marking.js             ← scoring engine (full float precision, no rounding)
│   ├── tenant.js              ← tenant config + module access check via KV
│   └── theme.js               ← per-tenant UI colour tokens
├── fe/
│   ├── shared/                ← pure JS — no platform APIs — web + mobile + desktop import this
│   │   ├── scoring.js         ← computeClientResult() — mirrors marking.js exactly
│   │   └── qstate.js          ← getQState(), Q_STATE, Q_STATE_COLOR (5-state palette)
│   ├── web/                   ← browser (HTMX + Tailwind CDN, zero build step)
│   │   ├── index.html
│   │   ├── app.js
│   │   ├── storage.js         ← IndexedDB result queue
│   │   ├── sync.js            ← batch flush: 4 results OR 24h
│   │   └── sw.js              ← service worker
│   ├── mobile/                ← React Native (Expo) — phone + tablet
│   │   ├── ExamScreen.js      ← isTablet() → split view vs bottom-sheet palette
│   │   ├── ResultScreen.js
│   │   ├── components/
│   │   │   ├── QuestionCard.js
│   │   │   ├── Palette.js
│   │   │   ├── Timer.js
│   │   │   └── ActionBar.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── storage.js     ← expo-sqlite
│   │   │   └── sync.js
│   │   └── utils/
│   │       └── layout.js      ← isTablet(): width >= 768
│   └── desktop/               ← Electron (v2 stub)
│       └── .gitkeep
├── tests/
│   ├── marking.test.js        ← Vitest: 7 scoring cases + exact 1/3 precision
│   └── tsf.test.js            ← Vitest: 9 TSF builder + state machine cases
├── package.json               ← { main: "backend/worker.js" }
├── wrangler.toml              ← assets: ./fe, KV, R2, DO bindings, routes
└── CHANGELOG.md
```

---

## Platform Structure

```
platform/
├── gateway/                   ← CF Worker: hostname → tenant → module routing
│   ├── worker.js
│   └── wrangler.toml
└── lambda/                    ← AWS Lambda: one SAM stack
    ├── tenant/
    │   ├── tps/handler.py     ← ACTIVE v1: tenant provisioning
    │   ├── tms/handler.py     ← STUB → activate on first migration need
    │   └── tgm/handler.py     ← STUB → activate at 20 tenants / 50k users
    ├── content/
    │   ├── bs/handler.py      ← ACTIVE v1: bundle builder
    │   ├── eps/handler.py     ← ACTIVE v1: event processor
    │   └── cgs/handler.py     ← STUB → activate at 1000 submissions/day
    ├── shared/
    │   ├── config.py
    │   ├── db.py
    │   └── models.py
    ├── migrations/
    ├── template.yaml
    └── requirements.txt
```

---

## Auth + Navigation

```
modules/auth/                  ← identity only: OTP, JWT, module access list
  backend/worker.js            ← login routes, JWT issue, module switcher data
  fe/web/                      ← login page + home/switcher (web)
  fe/mobile/                   ← LoginScreen + HomeScreen (React Native)

modules/app-shell/             ← composition root: navigation wiring ONLY
  mobile/App.js                ← imports from auth + all exam modules. Nothing else.
  package.json                 ← Expo entry point
```

**Rule:** app-shell is the ONLY file allowed to import across module boundaries.

---

## Domain Routing

```
allen.m99-core.com             → gateway → slug:allen → tenant_id → auth → module
test.allen.ac.in               → CNAME → CF for SaaS → same flow

KV keys:
  slug:{slug}       → tenant_id
  domain:{host}     → tenant_id
  tenant:{id}       → { modules, tier, pg_host, theme }
  flag:{name}       → feature flag value

After login:
  1 module  → redirect directly
  2+ modules → HomeScreen switcher
```

---

## Rules

### Config
- `backend/config.js` is the ONLY source of truth for exam pattern
- Pattern change = update `config.js` only — zero other code changes
- `wrong: 1/3` exact fraction — never `0.33`

### Scoring
- `marking.js` (server) and `fe/shared/scoring.js` (client) must produce identical results
- Full float precision — no `Math.round` mid-calculation
- Display layer only: `score.toFixed(2)`

### Frontend imports
- Web: `import '/shared/scoring.js'` (absolute URL — CF serves `/shared/` from `./fe/shared/`)
- Mobile: `import '../shared/scoring.js'` (relative file path)
- Desktop: same as mobile

### Batch Sync
- Queue results locally first (IndexedDB / expo-sqlite)
- Flush: 4 results accumulated OR 24h since last flush
- Checked: every page load (web), every app foreground (mobile)

### Navigation (mobile)
- Screen names: `{ModuleId}Exam`, `{ModuleId}Result`
- Registered ONLY in `app-shell/mobile/App.js`
- Modules never import from app-shell or from each other

### Question States (5-state palette)
| State | Colour | Condition |
|---|---|---|
| not_visited | #9E9E9E gray | Never opened |
| not_answered | #E53935 red | Opened, no answer |
| answered | #43A047 green | Answer saved |
| marked_review | #8E24AA purple | Flagged, no answer |
| answered_marked | #6A1B9A dark purple | Flagged + answered |

---

## Adding a New Module

1. Copy `modules/rrb-group-d/` → `modules/{new-id}/`
2. Update `backend/config.js` — pattern, sections, marking
3. Update `package.json` — name field
4. Update `wrangler.toml` — worker name, routes
5. Add to `modules/app-shell/mobile/App.js` — 2 imports + 2 Stack.Screen lines
6. Add to `modules/auth/backend/access.js` — module registry entry
7. Add service binding to `platform/gateway/wrangler.toml`
8. Deploy: `wrangler deploy` from new module folder

---

## v1 Scope (start here)

**Active:** gateway, auth, app-shell, rrb-group-d, TPS, BS, EPS  
**Stub (implement on signal):** TMS, TGM, CGS, multi-region, Durable Objects, queues

### Traffic-Driven Activation

| Feature | Activate when |
|---|---|
| TGM | > 20 tenants OR any tenant > 50k users |
| TMS | First tenant needs tier migration |
| CGS | > 1000 exam submissions/day |
| Multi-region | > 500 tenants OR region latency complaints |
| Durable Objects | Real-time feature demanded by paying tenant |

### Feature Flags in KV (flip to activate — no deploy needed)
```
flag:tgm_active    = "false"
flag:cgs_active    = "false"
flag:multi_region  = "false"
flag:batch_size    = "4"
flag:flush_hours   = "24"
```

---

## Stable Contracts (set in v1, never change)

| Contract | Notes |
|---|---|
| TSF JSON schema | Server↔client exam session contract |
| KV key format | `slug:` `domain:` `tenant:` `flag:` |
| Module API routes | `/config` `/session` `/start` `/answer` `/flag` `/submit` `/result` |
| Batch result format | Stored locally + synced to backend |
| QID format | `SUBJECT-topic-subtopic-type-difficulty-cat-seq` (7 parts) |
| 5 question states | not_visited, not_answered, answered, marked_review, answered_marked |

---

## Evolution Path

```
v1   → 5–10 tenants, 1 region, TPS + BS + EPS active
v1.5 → TGM activates (20 tenants signal)
v2   → TMS activates (first migration signal)
v2.5 → CGS activates (1000 submissions/day signal)
v3   → multi-region gateway + second RDS region
v3.5 → Durable Objects for real-time proctoring
```

No rewrites at any step. Every activation = flip flag + fill stub.
