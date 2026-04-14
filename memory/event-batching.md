# Event Batching + Dynamic Priority

## Multi-User Aggregated Batching

- All users in tenant group → 1 active batch file per priority (not per-user)
- Reduces R2 ops by 100–1000×
- All writes via DO only; never directly to R2 [!]

## Priority Levels

| P | Event | Flush Delay |
|---|---|---|
| P0 | Subscription | 5-sec flush |
| P1 | Settings updates | 5-min |
| P2 | First-attempt results | 10-min |
| P3 | Repeat-attempt results | 30-min |
| P4–P5 | General | 1–3 hr |
| P6 | General | 6 hr |
| P7 | Passive analytics + bundle feedback | 1 week |

## File Lifecycle

```
Active → Locked → processing folder → Processing → (DB write confirmed) → Deleted
```

Batch file is never deleted until DB write is fully confirmed [!].

## Dynamic Priority (pA — processAfter)

```
dynamic_delay = base_delay × tier_factor × (1/attemptNo) × score_factor

tier_factor:  0.5 (premium) | 1.0 (free)
score_factor: 0.5 if score > 90 else 1.0
```

- `pA` = absolute UTC epoch; no timezone logic in processing engine [!]
- `pA` stored as absolute UTC epoch; recalculated by SS on settings overwrite

## EIS Flow (CF Worker + DO)

```
POST /v1/events
→ Validate
→ Compute pA
→ Assign P0–P7
→ DO (Durable Object — 1 per tenant, serialized writer)
→ DO writes immediately to R2 on arrival [!]
```

## EPS Flow (Lambda)

```
Trigger: 5-min/30-min poll + 3–7AM IST + threshold
→ Poll ECDN (R2 event files)
→ Chunk 100 events
→ Checkpoint to tenant PG via RDS Proxy
→ Trigger CGS only after confirmed DB write [!]
```
