# Mock Test Platform — Project Overview

## What

Ultra-low-cost, offline-first mock test platform for India.
Students take timed, scored mock exams on web + mobile.
Institutes (tenants) get branded subdomains or custom domains.

## Scale Targets

| Horizon | Tenants | Users |
|---|---|---|
| v1 | 5–10 | 50k–1L |
| v2 | 20+ | 5L+ |
| v3 | 500+ | multi-crore |
| Ultimate | 2000 | 16–20 Cr |

**Cost target:** ₹5–10/user/year → optimise toward ₹0.10 as scale grows

---

## v1 Scope (start here, everything else is stub)

| Service | Status | Activate when |
|---|---|---|
| gateway | ACTIVE | — |
| auth module | ACTIVE | — |
| rrb-group-d module | ACTIVE | — |
| TPS (tenant provisioning) | ACTIVE | — |
| BS (bundle builder) | ACTIVE | — |
| EPS (event processor) | ACTIVE | — |
| TGM (growth monitor) | STUB | > 20 tenants OR any tenant > 50k users |
| TMS (tenant migration) | STUB | First tenant needs tier migration |
| CGS (content grader/weakness) | STUB | > 1000 submissions/day |
| RDS Proxy | STUB | Lambda concurrency > 10 AND connection errors appear |
| Multi-region gateway | STUB | > 500 tenants OR latency complaints from SEA |
| Durable Objects | STUB | Real-time feature demanded by paying tenant |
| Read replicas | STUB | Read load signal from monitoring |
| SQS queues | STUB | EPS falls behind on batch processing |

**Single region in v1:** ap-south-1. Add ap-southeast-1 at v3 signal.

---

## Folder Structure

```
mock-test-platform/
├── docs/                         ← human-readable architecture docs
│   ├── architecture.md
│   └── exam-module.md
├── memory/                       ← THIS FOLDER — project memory (canonical)
├── platform/
│   ├── gateway/                  ← CF Worker: hostname → tenant → module routing
│   │   ├── worker.js
│   │   └── wrangler.toml
│   └── lambda/                   ← all AWS Lambda, one SAM stack
│       ├── tenant/
│       │   ├── tps/handler.py    ← ACTIVE
│       │   ├── tms/handler.py    ← STUB
│       │   └── tgm/handler.py    ← STUB
│       ├── content/
│       │   ├── bs/handler.py     ← ACTIVE
│       │   ├── eps/handler.py    ← ACTIVE
│       │   └── cgs/handler.py    ← STUB
│       ├── shared/
│       │   ├── __init__.py
│       │   ├── config.py
│       │   ├── db.py
│       │   └── models.py
│       ├── migrations/
│       │   ├── alembic.ini
│       │   ├── env.py
│       │   └── versions/
│       ├── template.yaml
│       ├── requirements.txt
│       └── pytest.ini
└── modules/
    ├── auth/                     ← identity only: OTP, JWT, module switcher
    │   ├── backend/
    │   │   ├── worker.js
    │   │   ├── otp.js
    │   │   ├── jwt.js
    │   │   └── access.js
    │   ├── fe/
    │   │   ├── web/              ← login page + home/switcher (HTMX)
    │   │   ├── mobile/           ← LoginScreen + HomeScreen (React Native)
    │   │   └── desktop/          ← stub
    │   ├── package.json
    │   └── wrangler.toml
    ├── app-shell/                ← composition root: nav wiring ONLY
    │   ├── mobile/App.js
    │   └── package.json
    └── rrb-group-d/              ← first exam module (template for all others)
        ├── backend/
        │   ├── worker.js         ← 8 routes + error boundary
        │   ├── config.js         ← exam pattern, sections, marking (ONLY source of truth)
        │   ├── tsf.js            ← TSF builder + state machine
        │   ├── marking.js        ← scoring engine (full float precision)
        │   ├── tenant.js         ← tenant config + KV access check
        │   └── theme.js          ← per-tenant colour tokens
        ├── fe/
        │   ├── shared/           ← pure JS — web + mobile + desktop import this
        │   │   ├── scoring.js    ← computeClientResult() — mirrors marking.js exactly
        │   │   └── qstate.js     ← getQState(), Q_STATE, Q_STATE_COLOR
        │   ├── web/              ← HTMX + Tailwind CDN, zero build step
        │   │   ├── index.html
        │   │   ├── app.js
        │   │   ├── storage.js    ← IndexedDB result queue
        │   │   ├── sync.js       ← batch flush: 4 results OR 24h
        │   │   └── sw.js         ← service worker
        │   ├── mobile/           ← React Native (Expo)
        │   │   ├── ExamScreen.js
        │   │   ├── ResultScreen.js
        │   │   └── components/
        │   └── desktop/          ← Electron (v2 stub)
        ├── tests/
        ├── package.json
        └── wrangler.toml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Edge runtime | Cloudflare Workers (JavaScript) |
| Edge storage | CF KV (routing + flags), R2 (bundles + content) |
| Compute | AWS Lambda (Python) |
| DB v1 | Single AWS RDS PostgreSQL, schema-per-tenant, no proxy |
| DB v2+ | RDS Proxy → schema groups → shared-DB-with-tenant_id |
| DB migrations | Alembic (Python) — per-schema, in TPS Lambda |
| Web FE | HTMX + Tailwind CDN (no build step) |
| Mobile FE | React Native (Expo) |
| Desktop FE | Electron (v2 stub) |
| Shared FE logic | Pure JS: scoring.js, qstate.js — per module |
| Testing | Vitest (JS) + Pytest (Python) |
| Deploy | Wrangler (CF Workers) + AWS SAM (Lambda) |

---

## Stable Contracts (set in v1, never change)

| Contract | Format |
|---|---|
| TSF JSON schema | Server↔client exam session contract |
| KV key format | `slug:` `domain:` `tenant:` `flag:` `tsf:` `idem:` |
| Module API routes | `/config` `/session` `/start` `/answer` `/flag` `/submit` `/result` |
| Batch result format | `{ test_id, module_id, score, correct, wrong, unattempted, answers, submitted_at }` |
| QID format | `SUBJ-topic-subtopic-type-difficulty-cat-000001` (7 parts) |
| 5 question states | not_visited · not_answered · answered · marked_review · answered_marked |
| Schema naming | `tenant_{slug}` — never changes after provisioning |

---

## Adding a New Exam Module

1. Copy `modules/rrb-group-d/` → `modules/{new-id}/`
2. Update `backend/config.js` — pattern, sections, marking
3. Update `package.json` — name field
4. Update `wrangler.toml` — worker name, routes
5. Add to `modules/app-shell/mobile/App.js` — 2 imports + 2 Stack.Screen lines
6. Add to `modules/auth/backend/access.js` — module registry entry
7. Add service binding to `platform/gateway/wrangler.toml`
8. Deploy: `wrangler deploy` from new module folder
