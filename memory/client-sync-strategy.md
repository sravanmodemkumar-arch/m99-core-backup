---
name: Client Sync Strategy
description: How web/mobile/desktop store results locally and batch-sync to CF Worker
type: project
---

## Core Rule

Results are computed client-side. CF Worker is called only to persist state — never to compute it.

## Batch Trigger (all platforms)

```
Flush result queue when EITHER:
  A) queue has >= 4 completed test results
  B) 24 hours have passed since last flush AND queue has > 0 results

Check trigger on:
  Web:     window load (every page open)
  Mobile:  useEffect on mount + AppState 'active' (foreground resume)
  Desktop: app 'ready' event
```

**Why 4:** balances CF Worker cost (5× reduction) vs data loss risk (max 3 results lost).
**Why 24h:** casual students (2-3 tests/week) still sync within 1 day. Leaderboard stays fresh.
**Check on open, not on timer:** no background processes, no service workers needed for this.

## Local Storage Per Platform

| Platform | Engine | Table/Store |
|---|---|---|
| Web | IndexedDB | `result_queue` store + `meta` store |
| Mobile | expo-sqlite | `result_queue` table + `meta` table |
| Desktop | better-sqlite3 | `result_queue` table + `meta` table |

Same schema across all platforms:
```sql
result_queue: id, test_id, module_id, score, correct, wrong, unattempted,
              per_section (JSON), answers (JSON), submitted_at
meta:         key ('last_flush'), value (ISO timestamp)
```

## Save Flow (per test submit)

```
1. Student clicks Submit
2. Confirmation modal shown (answered/unanswered/flagged count)
3. Student confirms
4. Result computed client-side (answer key in mock bundle)
5. result saved to IndexedDB/SQLite immediately  ← safe before any network call
6. Check trigger: queue >= 4 → flush now
7. If not flushing: show result screen (score already computed)
```

## Flush Flow

```
POST /exam/{module_id}/results/batch
{
  "uid": "...",
  "tenant_id": "...",
  "platform": "web | mobile | desktop",
  "results": [
    { test_id, score, correct, wrong, unattempted, per_section, answers, submitted_at },
    ...up to 4
  ]
}

On success: clear queue, update last_flush timestamp
On failure: keep queue, retry on next open (silent — student never sees this)
```

## Web Architecture (per module)

**No apps/web/ directory.** Each exam module serves its own HTML shell.

```
CF Worker (rrb-group-d):
  GET  /ui                     → HTML exam shell page
  GET  /exam/rrb-group-d/config → JSON (public)
  POST /exam/rrb-group-d/session → create session
  ...all other JSON API routes...
  POST /exam/rrb-group-d/results/batch → batch result flush
```

HTML shell loads from CDN (no build step):
```html
<script src="https://unpkg.com/htmx.org@2.0.3"></script>
<script src="https://cdn.tailwindcss.com"></script>
```

HTMX handles question navigation (partial swaps).
Vanilla JS handles timer, palette state, IndexedDB, sync.

## Mobile Architecture

`apps/mobile/` — ONE React Native (Expo) app for ALL exam modules.
- Calls whichever module's JSON API is needed
- expo-sqlite for local storage (same schema as above)
- Tablet: `isTablet = width >= 768` → split view (palette sidebar + question)
- Phone: bottom-sheet palette

## Desktop Architecture

`apps/desktop/` — Electron app (v2, later).
- Same JSON API calls as mobile
- better-sqlite3 for local storage
- Standard desktop layout (sidebar always visible)
