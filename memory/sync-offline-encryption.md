# Sync, Offline + Encryption

## Encryption

- Algorithm: AES-GCM 256-bit, Web Crypto API, fresh IV every write
- enc_secret: 32-byte hex, stored in tenant PG, embedded in JWT
- enc_secret is never rotated [!]
- Client: JWT → PBKDF2 (100k iterations, SHA-256) → memory only (never persisted to disk)
- JWT expiry → key cleared → data unreadable → new tests blocked

## Offline Storage

| Platform | Storage | Encryption |
|---|---|---|
| Web | IndexedDB | AES-GCM (Web Crypto API) |
| Mobile | SQLite (React Native / Flutter) | AES-GCM |
| Desktop | SQLite (Tauri + React) | AES-GCM |

Same offline logic and AES-GCM implementation across all platforms.

## Offline Rules

- Tests load from local storage only; zero API calls during test [!]
- >= 1 valid bundle always kept locally
- Background sync between sessions only (never during test)
- JWT expiry → new tests blocked; queued events → auth_blocked; resume on next login

## Client Sync Queue

| Status | Meaning |
|---|---|
| pending | Not yet sent to server |
| confirmed | Successfully written to DB |
| auth_blocked | 401 received; waiting for re-login |

### Backoff Strategy
- Start: 1s → doubles → max 1 hour
- Dropped after 5 retries or 7 days, whichever comes first
- 401 → auth_blocked (retry counter NOT incremented)
- Offline check before every sync attempt

### Special Rules
- Bundle swap: highest priority in queue
- Bundle swap deferred until active test session ends [!]

## Log Clearing

**Clears:**
- Processed R2 event objects
- Archived tenant PG rows outside retention config (RC)
- Lambda CloudWatch logs
- Stale CDN records

**Never clears [!]:**
- Active results
- In-retention rows
- Weakness snapshots (WS)
- Active bundles
- Enrollment records
- Global DB records
- Current-session data

**Rules:**
- RC = deployment config; never hardcoded [!]
- Clear operation is idempotent [!]
