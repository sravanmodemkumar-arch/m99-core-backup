# DB Architecture

## ID Formats

```
UID : {R}-{TID:4d}-{SEQ:6d}         e.g. A-0123-048702
      R = region (A/B) | TID = tenant | SEQ = per-tenant auto-increment
      Parse: region → KV → RDS instance + schema → row (zero extra hop)

QID : {SUBJ}-{TOPIC:2d}-{SUB:2d}-{TYPE}-{DIFF}-{CAT}-{SEQ:6d}
      e.g. MATH-03-02-S-M-C-000123
      Encodes: subject + topic + subtopic + type + difficulty + exam_cat
```

## Global DB (1 shared RDS instance)

All tenants read. No tenant writes content here.

```sql
subjects          (subject PK, topic_id, subtopic_id, topic_name, subtopic_name, class_levels, exam_cats)

questions         (qid PK, scope CHAR(1), v SMALLINT, langs TEXT[], yt BOOL, offline BOOL)
                  -- qid encodes: subject+topic+subtopic+type+difficulty+exam_cat
                  -- content:  r2://global/q/{qid}.json   (loaded on question open)
                  -- solution: r2://global/sol/{qid}.json  (loaded after submit)

exams             (exam_id PK, exam_name, category_id, board_id, exam_year, expiry_date, pattern_id)

exam_question_map (exam_id FK, qid FK, section, marks, neg_marks, q_type_override, scope)
                  PK = (exam_id, qid)

exam_categories   (category_id PK, category_name, level)
exam_boards       (board_id PK, board_name, category_id)
exam_patterns     (pattern_id PK, total_marks, duration_min, sections JSONB, neg_mark)

-- Indexes
idx: questions(scope)         -- open/restricted filter
idx: exam_question_map(exam_id)
```

**Size:** ~80 bytes/question in DB. 1L questions ≈ 8 MB/subject, 20 subjects ≈ 160 MB total.

## Tenant DB (per tenant schema tid_xxxx, T1/T2/T3 pooled)

Isolated per tenant. Stores qid reference only — never question content.

```sql
results           (UID, qid, attemptNo, bundleVersion, examOrSubjectId,
                   score, timeTaken, timestamp)
                  PK = (UID, qid, attemptNo)
                  INSERT ON CONFLICT DO NOTHING   -- idempotent

users             (UID, enc_secret, settings_update_count, settings_locked_timestamp)

user_settings     (UID, all_settings_fields, timestamp)
                  INSERT ON CONFLICT DO UPDATE if incoming timestamp newer

checkpoints       (priority_folder, last_processed_epoch, updated_at)

student_enrollment(UID, examOrSubjectId, bundle_type, enrolled_date, active)

weakness_snapshot (UID, subject→topic→subtopic accuracy JSON,
                   status, attempt_count, last_calculated_at)
```

## Connection Routing

| Service | Global RDS Proxy | Tenant RDS Proxy |
|---|---|---|
| BS (Bundle Svc) | read questions + exams | — |
| EPS (Event Processing) | read qid | write results |
| CGS (Content Gen) | read question hierarchy | read results + write WS |
| TPS/TMS (Provisioning/Migration) | run Alembic migrations | provision tenant schema |
| CF Workers | **never [!]** | always |

## DB Tier Sizing

| Tier | Users/tenant | Tenants/instance | RDS Proxy |
|---|---|---|---|
| T1 | 0–1L | 10 | 1 proxy/instance |
| T2 | 1L–2.5L | 3–5 | 1 proxy/instance |
| T3 | 2.5L+ | 2–3 | 1 proxy/instance |

**Warm Pool (WP):** 3×T1 + 2×T2 + 1×T3 always pre-provisioned; auto-refills on consumption.

**Promotion trigger (2 of 3, 5/7 rolling window):**
- user_count crosses tier threshold
- avg_write_latency > 300ms
- peak_connection_wait > 100ms

**Demotion:** 1st of month only; below lower threshold for 30 consecutive days.
