# Bundle Delivery

## Bundle Types

**Exam-wise:**
- Full exam = 1 bundle
- Delta: notification-driven
- version++ on pattern change

**Subject-wise:**
- Each subject = independent bundle
- Delta: monthly
- Swap deferred until session ends [!]

## Manifest Fields

```
bundle_type       exam or subject
exam/subject_id   identifier
version           monotonically increasing
SHA-256           integrity hash
size              bytes
release_date      UTC epoch
expiry_date       UTC epoch
deprecated_flag   boolean
QID               on every question [!]
```

## Integrity Check

1. Client downloads new bundle
2. Verifies SHA-256 before write
3. Fail → keep old bundle, retry
4. Delete old only after new passes integrity check [!]

## Access Control (BAS)

- JWT + enrollment check before serving any bundle URL [!]
- Signed R2 URL (time-limited)
- Bundle swap never interrupts active test session [!]

## Bundle Build (BS Lambda)

- Reads global.questions (global RDS Proxy)
- Builds bundles
- Writes SHA-256 manifest to R2
- QID must be on every question — BS rejects malformed QIDs at build [!]

## Client Storage

| Platform | Storage |
|---|---|
| Web | IndexedDB + AES-GCM |
| Mobile | Filesystem (SQLite) + AES-GCM |
| Desktop | Filesystem (SQLite) + AES-GCM |

- >= 1 valid bundle always kept locally
- Tests load from local storage; zero API during test [!]
- Background sync between sessions only
