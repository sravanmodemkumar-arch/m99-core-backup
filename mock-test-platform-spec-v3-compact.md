# Mock Test Platform Spec v3 — Compact

## Legend
```
CF=Cloudflare | DO=Durable Object | KV=CF Workers KV | R2=CF R2 | λ=AWS Lambda
RDS=AWS RDS PostgreSQL | PG=PostgreSQL | RP=RDS Proxy | GDB=Global DB
TID=tenantId | GID=groupId | UID=userId | QID=questionId | pA=processAfter
DW=dual-write | WP=warm pool | EIS=Event Ingestion | EPS=Event Processing
CGS=Content Gen | BS=Bundle Svc | BAS=Bundle Access | AS=Auth | SS=Settings
TPS=Tenant Provisioning | TGM=Tenant Growth Monitor | TMS=Tenant Migration
T1/T2/T3=DB Tier | WS=weakness_snapshot | RC=retention config | [!]=non-negotiable
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Edge runtime | Cloudflare Workers (JavaScript) |
| Edge storage | CF KV, R2, Durable Objects |
| Compute | AWS Lambda (Python) — ap-south-1 + ap-southeast-1 |
| Global DB | AWS RDS PostgreSQL — 1 shared instance, global schema |
| Tenant DB | AWS RDS PostgreSQL — T1/T2/T3 pooled, schema-per-tenant |
| DB proxy | RDS Proxy — 1 global proxy + 1 per tenant tier [!] |
| DB migrations | Alembic (Python, runs in TPS/TMS Lambda) |
| Client web | IndexedDB + AES-GCM (Web Crypto API) |
| Client mobile | SQLite + AES-GCM (React Native / Flutter) |
| Client desktop | SQLite + AES-GCM (Tauri + React) |
| Monitoring | CF Logpush → Analytics Engine, Grafana, CloudWatch |
| Deploy | Wrangler (CF Workers) + AWS SAM (Lambda) |
| Testing | Vitest (JS) + Pytest (Python) |
| Secrets | AWS Secrets Manager (enc_secret seeds + DB credentials) |
| Rate limiting | CF Workers rate limiting on /auth/login + /events |

---

## Scale + Cost

- 2000 tenants x 80k-1L users = 16-20 Cr total
- 10 tenants share 1 T1 instance -> ~200 instances
- Lambda: ap-south-1 (A) + ap-southeast-1 (B), 1000 tenants/region
- Target: Rs 0.1-2/user/year

| Users | CF Workers | Lambda | RDS+RP | R2 | Total/mo | Rs/user/yr |
|---|---|---|---|---|---|---|
| 10k | Rs12 | Rs5 | Rs1,050 | Rs5 | Rs1,072 | Rs1.29 |
| 20k | Rs24 | Rs10 | Rs1,050 | Rs10 | Rs1,094 | Rs0.66 |
| 30k | Rs36 | Rs15 | Rs1,050 | Rs15 | Rs1,116 | Rs0.45 |
| 40k | Rs48 | Rs20 | Rs1,550 | Rs20 | Rs1,638 | Rs0.49 |

> RDS Proxy adds ~Rs50/instance/month; eliminates connection exhaustion at Lambda scale.

---

## ID Formats

```
UID : {R}-{TID:4d}-{SEQ:6d}              A-0123-048702
      R=region A/B | TID=tenant | SEQ=per-tenant auto-increment
      Parse: region -> KV -> RDS instance + schema -> row (zero extra hop)

QID : {SUBJ}-{TOPIC:2d}-{SUB:2d}-{TYPE}-{DIFF}-{CAT}-{SEQ:6d}
      MATH-03-02-S-M-C-000123

      SUBJ = subject code (MATH|PHY|CHEM|BIO|ENG|HIST|GEO|ECO|POL|CS|REAS|GK...)
      TOPIC= 2-digit topic index
      SUB  = 2-digit subtopic index
      TYPE = S=mcq_single M=mcq_multiple N=numerical B=fill_blank T=true_false
             C=match_column A=assertion_reason K=statement P=passage_based
             J=subjective D=descriptive R=data_sufficiency Q=sequence X=matrix
      DIFF = E=easy M=medium H=hard X=expert
      CAT  = S=school I=intermediate C=competitive D=degree B=school+intermediate A=all
      SEQ  = 6-digit auto-increment per subtopic

      QID tells: subject + topic + subtopic + type + difficulty + exam_cat
      Zero extra DB fields needed for these
      Content path: r2://global/q/{qid}.json (built from QID)
      Solution path: r2://global/sol/{qid}.json (built from QID)
```

---

## DB Architecture

### Global DB (1 shared RDS instance, global schema)
All tenants read; no tenant writes content here.

```
subjects          (subject PK, topic_id, subtopic_id, topic_name, subtopic_name, class_levels, exam_cats)
questions         (qid PK, scope CHAR(1), v SMALLINT, langs TEXT[], yt BOOL, offline BOOL)
                   qid encodes: subject+topic+subtopic+type+difficulty+exam_cat
                   content: r2://global/q/{qid}.json (loaded on question open)
                   solution: r2://global/sol/{qid}.json (loaded after submit)
exams             (exam_id PK, exam_name, category_id, board_id, exam_year, expiry_date, pattern_id)
exam_question_map (exam_id FK, qid FK, section, marks, neg_marks, q_type_override, scope) PK=(exam_id,qid)
exam_categories   (category_id PK, category_name, level)
exam_boards       (board_id PK, board_name, category_id)
exam_patterns     (pattern_id PK, total_marks, duration_min, sections JSONB, neg_mark)

idx: questions(scope) — for open/restricted filter
idx: exam_question_map(exam_id)
```

### Tenant DB (per tenant schema tid_xxxx, T1/T2/T3 pooled)
Isolated per tenant; stores qid reference only, never question content.

```
results           (UID, qid, attemptNo, bundleVersion, examOrSubjectId,
                   score, timeTaken, timestamp) PK=(UID,qid,attemptNo)
                   INSERT ON CONFLICT DO NOTHING
users             (UID, enc_secret, settings_update_count, settings_locked_timestamp)
user_settings     (UID, all_settings_fields, timestamp)
                   INSERT ON CONFLICT DO UPDATE if incoming timestamp newer
checkpoints       (priority_folder, last_processed_epoch, updated_at)
student_enrollment(UID, examOrSubjectId, bundle_type, enrolled_date, active)
weakness_snapshot (UID, subject->topic->subtopic accuracy JSON,
                   status, attempt_count, last_calculated_at)
```

### Connection Routing

| Service | Global RDS Proxy | Tenant RDS Proxy |
|---|---|---|
| BS | read questions + exams | — |
| EPS | read qid | write results |
| CGS | read question hierarchy | read results + write WS |
| TPS/TMS | run Alembic migrations | provision tenant schema |
| CF Workers | never [!] | always |

---

## Tenant Rules
- Every tenant table namespaced by TID; TID+GID in every JWT; no cross-tenant queries ever
- Routing: KV edge-cached -> PG host + schema + group via RDS Proxy
- GID set by admin at provisioning only [!]; system never auto-assigns
- 1 tenant schema failure -> only that tenant affected
- All tenants in group: enter + exit DW simultaneously [!]; partial group migration never allowed [!]

### Groups
- Admin sets GID by org/exam/geography affinity at provisioning
- All group tenants share PG instance via RDS Proxy; migrate together as unit
- Diverging tenant (3x above group avg for 5/7 days) -> extraction via TMS

### New Tenant (fully automated, zero code changes)
Admin inputs TID+GID+bundle_strategy+exam_subject_config ->
TPS Lambda: provision PG schema -> Alembic migrations -> register KV -> create R2 folders (ECDN+CCDN) -> generate enc_secret -> deploy initial bundle

---

## Infrastructure

**CF layer:** Workers (AS,SS,EIS,BAS; zero cold start) | KV (routing+group tables) | R2 (ECDN+CCDN; zero egress) | DO (1 serialized writer/tenant) | Logpush -> Analytics Engine

**AWS layer:** Lambda (EPS,CGS,BS,TPS,TGM,TMS; 15-min max) | Global RDS PG (questions/exams/subjects) | Tenant RDS PG (T1/T2/T3 pooled) | RDS Proxy (1 global + 1 per tier) [!] | CloudWatch

---

## Services

### JavaScript — CF Workers

| Service | Endpoints | Key Logic |
|---|---|---|
| AS | POST /v1/auth/login, GET /v1/auth/validate | Login+JWT; embeds UID+TID+GID+enc_secret; KV tenant resolution |
| SS | GET /v1/settings, PATCH /v1/settings | 3-update lifetime limit server-side [!]; pA recalc on overwrite; returns remaining count |
| EIS+DO | POST /v1/events | Validate->pA->P0-P7->DO->R2; DO writes immediately on arrival [!] |
| BAS | GET /v1/bundle, POST /v1/bundle/swap | JWT+enrollment check; signed R2 URL; swap deferred until session ends [!] |

### Python — AWS Lambda

| Service | Trigger | Key Logic |
|---|---|---|
| EPS | 5-min/30-min poll + 3-7AM IST + threshold | Poll ECDN; chunk 100; checkpoint to tenant PG via RDS Proxy; trigger CGS after confirmed write [!] |
| CGS | EPS only, after confirmed DB write [!] | JOIN tenant.results + global.questions; compute WS rollup; push to CCDN R2 |
| BS | Notification-driven (exam) / monthly (subject) | Read global.questions; build bundles; SHA-256 manifest; QID on every question [!] |
| TPS | On-demand admin | Tenant PG schema -> Alembic migrations -> R2 folders -> KV -> enc_secret; pull from WP |
| TGM | Daily 2AM IST | Composite trigger (2 of 3); 5/7 rolling window; promote/demote/extract |
| TMS | Triggered by TGM | 5-phase: provision->DW activate->backfill->verify (PG row count+checksum)->cutover |

---

## Client Apps

| | Web | Mobile | Desktop |
|---|---|---|---|
| Framework | Browser | React Native / Flutter | Tauri + React |
| Storage | IndexedDB | SQLite | SQLite |
| Encryption | AES-GCM Web Crypto | AES-GCM | AES-GCM |
| Sync | Background | Background | Background |
| Bundle | Local cache | Filesystem | Filesystem |
| Deploy | Browser | App Store / Play Store | Win/Mac/Linux installer |

Same offline logic, same sync queue, same AES-GCM across all platforms. No new backend services.

---

## Multi-User Aggregated Batching

All users in tenant group -> 1 active batch file per priority (not per-user) -> reduces R2 ops 100-1000x
All writes via DO only; never directly to R2 [!]

| P | Event | Delay |
|---|---|---|
| P0 | Subscription | 5-sec flush |
| P1 | Settings updates | 5-min |
| P2 | First-attempt results | 10-min |
| P3 | Repeat-attempt results | 30-min |
| P4-P5 | General | 1-3 hr |
| P6 | General | 6 hr |
| P7 | Passive analytics + bundle feedback | 1 week |

File lifecycle: Active -> Locked -> processing folder -> Processing -> (DB write confirmed) -> Deleted

---

## Dynamic Priority (pA)

```
dynamic_delay = base_delay x tier_factor x (1/attemptNo) x score_factor
pA = event_timestamp + dynamic_delay
tier_factor: 0.5 (premium) | 1.0 (free)
score_factor: 0.5 if score>90 else 1.0
```
pA = absolute UTC epoch; no timezone logic in processing engine [!]

---

## Bundle Delivery

**Exam-wise:** full exam = 1 bundle | delta: notification-driven | version++ on pattern change
**Subject-wise:** each subject = independent bundle | delta: monthly | swap deferred until session ends [!]
**Manifest:** bundle_type | exam/subject_id | version | SHA-256 | size | release_date | expiry_date | deprecated_flag | QID per question [!]
**Integrity:** client verifies SHA-256 before write; fail->keep old, retry; delete old only after new passes

---

## Dynamic DB Allocation

| Tier | Users | Tenants/instance | RDS Proxy |
|---|---|---|---|
| T1 | 0-1L | 10 | 1 proxy/instance |
| T2 | 1L-2.5L | 3-5 | 1 proxy/instance |
| T3 | 2.5L+ | 2-3 | 1 proxy/instance |

**WP:** 3xT1 + 2xT2 + 1xT3 always pre-provisioned; auto-refills on consumption
**Promotion:** 5/7 rolling days; composite trigger (2 of 3: user_count crosses tier threshold | avg_write_latency>300ms | peak_connection_wait>100ms)
**Demotion:** 1st of month only; below lower threshold for 30 consecutive days

---

## Weakness Analysis (Subject -> Topic -> Subtopic)

```sql
-- CGS: JOIN tenant.results + global.questions on qid
subtopic_score = AVG(score) WHERE subtopic_id=X AND UID=Y
topic_score    = AVG(subtopic_scores for topic)
subject_score  = AVG(topic_scores for subject)
weakness_score = 100 - accuracy%
rank           = ASC (lowest=weakest)
```

| Status | Condition | Display |
|---|---|---|
| no_data | 0 attempts | Grey; "Not started"; no score [!] |
| partial | attempt_count < 3 | Show subtopics; "Need X more" |
| ready | attempt_count >= 3 | Full bar + colour |

Colour: <60% red | 60-74% amber | >=75% green | "Focus here" badge on bottom 2 topics/subject

---

## Encryption

- AES-GCM 256-bit, Web Crypto API, fresh IV every write
- enc_secret: 32-byte hex, server-side, stored in tenant PG, embedded in JWT, never rotated
- Client: JWT->PBKDF2 (100k iter, SHA-256)->memory only (never persisted)
- JWT expiry->key cleared->data unreadable->new tests blocked

---

## Attempt Tracking

- Every attempt = separate tenant PG record; never overwritten; PK: UID+qid+attemptNo
- Client generates attemptNo from local count; EPS validates: must = current_max+1 [!]
- Idempotent: INSERT ON CONFLICT DO NOTHING

---

## Offline + Subscription

- Web: IndexedDB+AES-GCM | Mobile: SQLite+AES-GCM | Desktop: SQLite+AES-GCM
- Tests load from local storage; zero API during test [!]
- Background sync between sessions only; >=1 valid bundle always kept locally
- JWT expiry->new tests blocked; queued events->auth_blocked; resume on next login

---

## Sync Queue (Client)

- syncStatus: pending | confirmed | auth_blocked
- Backoff: 1s->doubles->max 1h; dropped after 5 retries or 7 days
- 401->auth_blocked (retry counter not incremented); offline check before every attempt
- Bundle swap: highest priority; deferred until session ends [!]

---

## Log Clearing

**Clears:** processed R2 event objects | archived tenant PG rows outside RC | Lambda CloudWatch logs | stale CDN records
**Never clears [!]:** active results | in-retention rows | WS | active bundles | enrollment | global DB records | current-session data
**RC = deployment config; never hardcoded [!]; idempotent**

---

## Observability

| Area | Alert Threshold |
|---|---|
| ECDN lag | P2>2h = incident; P7>3wk = incident |
| DO buffer | Not flushed within 2x expected; failure_count>0 = immediate |
| DB+RDS Proxy | write_latency>500ms; connections->limit; any tenant 3x above 30-day baseline |
| Global DB | query_latency>200ms; connection_wait>50ms |
| Lambda | invocation>12min; same tenant timeout>2x/day; DW overhead>48h |
| CCDN staleness | gap>10min vs last confirmed PG write |
| Bundle | download_fail>2%/1h; swap stuck>24h |
| Sync queue | retry_count>2; age>1day; auth_blocked spike |
| WP | below minimum = critical |
| Cost anomaly | any metric >2x 30-day avg |

**Tiers:** Critical (immediate) | Warning (same-day) | Info (weekly)
**Tooling:** CF Logpush -> Analytics Engine | Grafana (self-hosted) | CloudWatch | <Rs2k/month

---

## Non-Negotiable Rules [!]

1. DO writes every event to R2 immediately on arrival (crash = zero loss)
2. Batch file never deleted until DB write fully confirmed
3. Settings update count enforced server-side only in tenant PG
4. attemptNo validated server-side in EPS
5. CCDN updated by CGS only after confirmed tenant PG write
6. pA stored as absolute UTC epoch; no timezone logic
7. Fan-out threshold = deployment config; never hardcoded
8. BAS validates enrollment before serving any bundle URL
9. Bundle swap never interrupts active test session
10. Group promotion uses 5/7 rolling window
11. GID always set by admin at provisioning
12. All group tenants enter+exit DW simultaneously
13. QID encodes subject+topic+subtopic+type+difficulty+exam_cat; BS rejects malformed at build [!]
14. DB stores only: qid, v, scope, langs, yt, offline — everything else derived from QID or loaded from R2
15. Content file loaded from R2 on question open; solution file loaded only after submit [!]
14. Weakness score shown only when status=ready; no_data != score=0%
15. Topic score only from attempted subtopics; never assume 0 for untouched
16. Log clearing never touches active results, in-retention rows, WS, active bundles, enrollment, global DB
17. RC = deployment config; never hardcoded; clear operation is idempotent
18. All Lambda->RDS connections via RDS Proxy only; never direct
19. Questions/subjects/exams in global schema only; never duplicated per tenant
20. Tenant schema stores qid reference only; never question content
21. CF Workers never access global schema
22. BS reads global schema; writes manifests to R2 only

---

## Goal
Ultra-low-cost offline-first mock test platform | 2000 tenants | group-based dynamic PG allocation T1/T2/T3 via RDS Proxy | global question bank (shared across all tenants + exams) | exam+subject bundle delivery with enrollment-gated access | two-CDN (CF R2) | multi-user aggregated batching P0-P7 | AES-GCM encrypted local storage (web+mobile+desktop) | per-attempt result tracking | subject->topic->subtopic weakness analysis | log clearing | chunk-checkpoint Lambda across 2 regions | full observability | 16-20 Cr users at Rs0.1-2/user/year
