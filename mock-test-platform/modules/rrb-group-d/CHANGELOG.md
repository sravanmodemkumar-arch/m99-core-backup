# rrb-group-d Changelog

## v1.0.0 — 2024-04-14

### Added
- Initial module scaffold for RRB Group D CBT
- `src/config.js` — exam pattern (100Q / 90min / -1/3 neg / 4 sections)
- `src/tsf-builder.js` — Test Session File builder (single JSON for entire exam)
- `src/marking-engine.js` — score computation with section breakdown
- `src/tenant-config.js` — 3-level tenant config resolution
- `src/theme.js` — RRB CBT UI theme (matches real exam interface)
- `src/index.js` — CF Worker entry with error boundary + full route handler
- Tests: marking engine (7 cases) + TSF builder (9 cases)
- Idempotency on submit (X-Idempotency-Key header)
- Canary routing via module registry KV
- Module health endpoint

### Pattern
- exam_id   : RRB-GROUP-D-{YEAR}
- pattern_id: RRB-GRP-D-PAT-V3
- Sections  : Mathematics(25) + Reasoning(30) + Science(25) + GK(20) = 100Q
- Duration  : 90 min | Marks: 100 | Neg: -1/3
