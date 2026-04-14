---
name: RRB Group D Module — Reference Implementation
description: First fully built exam module (v1.0.0). Defines the canonical file layout, API contract, and patterns all future modules must follow.
type: project
---

## Status

**v1.0.0** — committed to `dev` branch on 2026-04-14.  
Repo: `sravanmodemkumar-arch/m99-core` → `modules/rrb-group-d/`

## Exam Pattern

- **exam_id**: `RRB-GROUP-D-{YEAR}` | **pattern_id**: `RRB-GRP-D-PAT-V3`
- **Sections**: Mathematics (S1, 25Q) + Reasoning (S2, 30Q) + Science (S3, 25Q) + GK (S4, 20Q) = 100Q
- **Duration**: 90 min (5400 sec) + 60 sec grace
- **Marking**: +1 correct, -1/3 (exact) wrong, 0 unattempted — never use 0.33
- **Languages**: English + Hindi (bilingual, both always visible, toggle highlights one)
- **Config flags**: no calculator, free section nav, free question nav, watermark on, tab switch limit = 3

## File Layout (canonical — all modules follow this)

Flat structure. Max 3 levels deep. No subfolders inside backend/ or frontend/.

```
modules/rrb-group-d/
  ├── backend/                   — CF Worker JSON API (flat, max 6 files)
  │   ├── worker.js              — entry point + router
  │   ├── config.js              — EXAM_PATTERN, Q_STATE, TEST_STATUS, EVENT_PRIORITY
  │   ├── tsf.js                 — TSF builder
  │   ├── marking.js             — scoring (exact 1/3, no rounding)
  │   ├── tenant.js              — 3-level tenant resolution
  │   └── theme.js               — RRB CBT colors + layout
  ├── frontend/                  — web UI (HTMX + Tailwind CDN, flat, max 5 files)
  │   ├── index.html             — exam shell
  │   ├── app.js                 — timer, palette, navigation
  │   ├── storage.js             — IndexedDB result queue
  │   ├── sync.js                — batch flush (4 results OR 24h)
  │   └── sw.js                  — service worker
  ├── mobile/                    — React Native screens
  │   ├── ExamScreen.js          — full exam UI
  │   ├── ResultScreen.js        — score + section breakdown
  │   ├── components/
  │   │   ├── QuestionCard.js
  │   │   ├── Palette.js         — bottom-sheet (phone) / sidebar (tablet)
  │   │   ├── Timer.js
  │   │   └── ActionBar.js
  │   ├── services/
  │   │   ├── api.js             — calls this module's CF Worker
  │   │   ├── storage.js         — expo-sqlite result queue
  │   │   └── sync.js            — 4 results OR 24h flush
  │   └── utils/
  │       └── layout.js          — isTablet = width >= 768
  ├── desktop/                   — Electron (v2, placeholder)
  ├── tests/                     — flat
  │   ├── marking.test.js        — 7 test cases
  │   └── tsf.test.js            — 9 test cases
  ├── package.json
  ├── wrangler.toml              — main="backend/worker.js", [assets] dir="./frontend"
  └── CHANGELOG.md
```

**Current state in repo:** old `src/` layout. Next task: restructure to this layout.

## API Routes (worker.js — 8 routes + 1 batch route)

| Method | Path | What it does |
|---|---|---|
| GET | /health | Module health check (no auth) |
| GET | /exam/rrb-group-d/config | Public exam pattern (no auth) |
| POST | /exam/rrb-group-d/session | Create TSF, store in KV (48h TTL) |
| GET | /exam/rrb-group-d/:test_id | Fetch TSF (content stripped) |
| POST | /exam/rrb-group-d/:test_id/start | Start timer, set status=in_progress |
| POST | /exam/rrb-group-d/:test_id/answer | Save or clear answer |
| POST | /exam/rrb-group-d/:test_id/flag | Toggle mark-for-review |
| POST | /exam/rrb-group-d/:test_id/submit | Submit (idempotent via X-Idempotency-Key), emits P0 event |
| GET | /exam/rrb-group-d/:test_id/result | Compute result from R2 answer key |

## TSF Structure

Single JSON file drives the entire exam. Key fields:

```json
{
  "tsf_version": "1.0.0",
  "test_id": "TST-RRB-GROUP-D-...",
  "exam_id": "RRB-GROUP-D-2024",
  "tenant_id": "allen",
  "candidate": { "uid", "name", "roll_no", "photo_url" },
  "sections": [ { "sid", "label", "subject", "q_count", "q_from", "q_to" } ],
  "questions": [ { "qno", "qid", "sid", "content": null } ],
  "schedule": { "duration_sec": 5400, "grace_sec": 60, "start_at": null, "end_at": null },
  "state": {
    "status": "not_started | in_progress | submitted",
    "visited": [],
    "answers": {},
    "flags": {}
  },
  "integrity": { "module_id", "module_version", "tsf_version", "q_hash", "is_mock", "canary", "q_count" }
}
```

## 5 Question States (from config.js)

| State | Color | Condition |
|---|---|---|
| not_visited | Gray #9E9E9E | not in visited[] |
| not_answered | Red #E53935 | in visited[], no answer |
| answered | Green #43A047 | has answer, not flagged |
| marked_review | Purple #8E24AA | flagged, no answer |
| answered_marked | Dark Purple #6A1B9A + tick | answered + flagged |

## Theme (matches real RRB CBT screenshot)

- Header bar: `#1A3A5C` (dark navy)
- Sub-header: `#2D5986` (medium blue)
- Timer warning < 10 min: `#FF8F00` | critical < 5 min: `#CC0000`
- Font: Noto Sans + Noto Sans Devanagari (bilingual support)

## Marking Precision Rule

`wrong: 1/3` in `config.js` — JavaScript stores it as `0.3333333333333333`.
No `Math.round(x * 100) / 100` anywhere in marking-engine. Full float precision preserved.
Display layer calls `score.toFixed(2)` for candidate view. Rank engine uses raw value.

**Why:** 100 wrong answers × 0.33 = -33.00. 100 × (1/3) = -33.3333... — difference matters for rank cut-off at scale.

## Key Patterns Established

1. **Error boundary**: `try/catch` wraps entire `handleRequest` — crash response returns 500 with `module_id` + `trace_id`, never exposes stack to client
2. **Idempotent submit**: `X-Idempotency-Key` header → KV cache `idem:{key}` (1hr TTL) — safe network retry
3. **P0 event on submit**: `ctx.waitUntil(emitEvent(...))` — non-blocking, guaranteed delivery attempt
4. **3-level tenant config**: platform env → tenant group KV → individual tenant KV (highest wins, deep merge)
5. **Canary routing**: `hash(uid) % 100 < canary_pct` — deterministic, same uid always same version
6. **JWT no lib**: Web Crypto API only — `atob(parts[1])` decode, check `exp` — no external dependency
7. **KV TTL**: TSF = 48h (`172800s`), idempotency = 1h (`3600s`)
8. **Answer key in R2**: `answer-keys/{exam_id}.json` — separate from TSF, loaded only on result fetch

## Test Coverage

- **tsf-builder**: structure, wrong Q count throws, section ranges, startTest timestamps, saveAnswer, clearAnswer, toggleFlag, all 5 states, integrity block
- **marking-engine**: +1 correct, -0.33 wrong, 0 unattempted, all correct=100, all wrong=-33, section sum=total, preview unanswered count
