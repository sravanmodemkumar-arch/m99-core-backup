# Exam Module

Version: v1.1.0
Layers: L01 (Foundation) + L28 (Admin)
Modules: Exam Category (1), Exam Board (2), Exam Pattern (3), Exam (4), Exam Admin (179)

---

## Overview

The Exam module is the core of the platform hierarchy. Every question, bundle,
result, enrollment and test session traces back to an exam or subject defined here.

It lives entirely in the **global DB** — read by all tenants, written only by admins.
Tenant schemas never duplicate exam data — they store `exam_id` references only.

---

## Entity Hierarchy

```
ExamCategory
  └── ExamBoard
        └── Exam
              ├── ExamPattern  (sections, marks, duration)
              └── ExamQuestionMap  (qid → section + marks per exam)
```

---

## DB Schema (Global DB)

### exam_categories

```sql
CREATE TABLE exam_categories (
  category_id   VARCHAR(8)   PRIMARY KEY,   -- C, S, I, D, B, A (matches QID cat code)
  category_name VARCHAR(64)  NOT NULL,
  level         INTEGER      NOT NULL        -- 1=school, 2=intermediate, 3=competitive, 4=degree
);
```

| category_id | category_name | level |
|---|---|---|
| S | School | 1 |
| I | Intermediate (11–12) | 2 |
| C | Competitive | 3 |
| D | Degree / UG | 4 |
| B | School + Intermediate | 2 |
| A | All | 1 |

Category codes match QID exam_cat field — zero extra join needed to filter questions.

---

### exam_boards

```sql
CREATE TABLE exam_boards (
  board_id      VARCHAR(16)  PRIMARY KEY,   -- NTA, CBSE, UPSC, SSC, IBPS ...
  board_name    VARCHAR(128) NOT NULL,
  category_id   VARCHAR(8)   REFERENCES exam_categories(category_id),
  country       VARCHAR(4)   NOT NULL DEFAULT 'IN',
  active        BOOLEAN      NOT NULL DEFAULT TRUE
);
```

| board_id | board_name | category_id |
|---|---|---|
| NTA | National Testing Agency | C |
| CBSE | Central Board of Secondary Education | S |
| ICSE | Indian Certificate of Secondary Education | S |
| UPSC | Union Public Service Commission | C |
| SSC | Staff Selection Commission | C |
| IBPS | Institute of Banking Personnel Selection | C |
| RRB | Railway Recruitment Board | C |
| STATE | State PSC (generic) | C |
| GATE | Graduate Aptitude Test in Engineering | D |
| NIOS | National Institute of Open Schooling | S |

---

### exam_patterns

```sql
CREATE TABLE exam_patterns (
  pattern_id    VARCHAR(32)  PRIMARY KEY,   -- JEE-MAIN-PAT-V3
  pattern_name  VARCHAR(128) NOT NULL,
  total_marks   INTEGER      NOT NULL,
  duration_min  INTEGER      NOT NULL,
  sections      JSONB        NOT NULL,      -- see Section JSONB spec below
  neg_mark      NUMERIC(4,2) NOT NULL DEFAULT 0,
  version       SMALLINT     NOT NULL DEFAULT 1,
  updated_at    BIGINT       NOT NULL       -- UTC epoch; triggers bundle rebuild on change
);
```

**pattern_id format:** `{EXAM_SHORT}-PAT-V{N}` → `JEE-MAIN-PAT-V3`

#### Section JSONB Structure

```json
[
  {
    "name":          "Physics",
    "subject_code":  "PHY",
    "q_count":       30,
    "marks_correct": 4,
    "marks_wrong":   -1,
    "marks_partial": 0,
    "type_allowed":  ["S", "N"],
    "optional_q":    0,
    "duration_min":  null
  }
]
```

| Field | Type | Purpose |
|---|---|---|
| name | string | Display name for section |
| subject_code | string | Links to subjects table (MATH, PHY ...) |
| q_count | int | Total questions in section |
| marks_correct | float | Marks for correct answer |
| marks_wrong | float | Negative marks (negative value) |
| marks_partial | float | Partial marks (JEE Advanced, matrix match) |
| type_allowed | string[] | QID type codes allowed in this section |
| optional_q | int | How many questions student can skip (JEE Adv style) |
| duration_min | int\|null | Per-section time limit; null = shared timer |

#### Section Examples by Exam

**JEE Main 2025**
```json
[
  { "name": "Physics",     "subject_code": "PHY",  "q_count": 30, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S","N"], "optional_q": 5,  "duration_min": null },
  { "name": "Chemistry",   "subject_code": "CHEM", "q_count": 30, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S","N"], "optional_q": 5,  "duration_min": null },
  { "name": "Mathematics", "subject_code": "MATH", "q_count": 30, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S","N"], "optional_q": 5,  "duration_min": null }
]
```

**NEET UG 2025**
```json
[
  { "name": "Physics A",   "subject_code": "PHY",  "q_count": 35, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0,  "duration_min": null },
  { "name": "Physics B",   "subject_code": "PHY",  "q_count": 15, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 10, "duration_min": null },
  { "name": "Chemistry A", "subject_code": "CHEM", "q_count": 35, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0,  "duration_min": null },
  { "name": "Chemistry B", "subject_code": "CHEM", "q_count": 15, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 10, "duration_min": null },
  { "name": "Biology A",   "subject_code": "BIO",  "q_count": 35, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0,  "duration_min": null },
  { "name": "Biology B",   "subject_code": "BIO",  "q_count": 15, "marks_correct": 4, "marks_wrong": -1, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 10, "duration_min": null }
]
```

**UPSC Prelims**
```json
[
  { "name": "General Studies I", "subject_code": "GK",   "q_count": 100, "marks_correct": 2,   "marks_wrong": -0.66, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0, "duration_min": 120 },
  { "name": "CSAT",              "subject_code": "REAS", "q_count": 80,  "marks_correct": 2.5, "marks_wrong": -0.83, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0, "duration_min": 120 }
]
```

**SSC CGL Tier 1**
```json
[
  { "name": "General Intelligence", "subject_code": "REAS", "q_count": 25, "marks_correct": 2, "marks_wrong": -0.5, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0, "duration_min": null },
  { "name": "General Awareness",    "subject_code": "GK",   "q_count": 25, "marks_correct": 2, "marks_wrong": -0.5, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0, "duration_min": null },
  { "name": "Quantitative",         "subject_code": "MATH", "q_count": 25, "marks_correct": 2, "marks_wrong": -0.5, "marks_partial": 0, "type_allowed": ["S"], "optional_q": 0, "duration_min": null },
  { "name": "English",              "subject_code": "ENG",  "q_count": 25, "marks_correct": 2, "marks_wrong": -0.5, "marks_partial": 0, "type_allowed": ["S","L"], "optional_q": 0, "duration_min": null }
]
```

**CBSE Class 10 Board**
```json
[
  { "name": "Mathematics",  "subject_code": "MATH", "q_count": 40, "marks_correct": 1, "marks_wrong": 0, "marks_partial": 0, "type_allowed": ["S","J","D"], "optional_q": 0, "duration_min": 180 },
  { "name": "Science",      "subject_code": "BIO",  "q_count": 40, "marks_correct": 1, "marks_wrong": 0, "marks_partial": 0, "type_allowed": ["S","J","D"], "optional_q": 0, "duration_min": 180 }
]
```

---

### exams

```sql
CREATE TABLE exams (
  exam_id       VARCHAR(48)  PRIMARY KEY,   -- NTA-JEE-MAIN-2025
  exam_name     VARCHAR(128) NOT NULL,
  short_name    VARCHAR(32)  NOT NULL,      -- JEE Main
  category_id   VARCHAR(8)   REFERENCES exam_categories(category_id),
  board_id      VARCHAR(16)  REFERENCES exam_boards(board_id),
  pattern_id    VARCHAR(32)  REFERENCES exam_patterns(pattern_id),
  exam_year     SMALLINT     NOT NULL,
  session       VARCHAR(8)   DEFAULT NULL,  -- JAN, APR, null for single-session
  expiry_date   BIGINT       NOT NULL,      -- UTC epoch; after this date bundle deprecated
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    BIGINT       NOT NULL,
  updated_at    BIGINT       NOT NULL
);

CREATE INDEX idx_exams_category  ON exams(category_id);
CREATE INDEX idx_exams_board     ON exams(board_id);
CREATE INDEX idx_exams_year      ON exams(exam_year);
CREATE INDEX idx_exams_active    ON exams(active);
```

**exam_id format:** `{BOARD_ID}-{SHORT_NAME_SLUGIFIED}-{YEAR}[-{SESSION}]`

| exam_id | exam_name |
|---|---|
| NTA-JEE-MAIN-2025-JAN | JEE Main January 2025 |
| NTA-JEE-MAIN-2025-APR | JEE Main April 2025 |
| NTA-NEET-2025 | NEET UG 2025 |
| UPSC-CSE-PRELIMS-2025 | UPSC CSE Prelims 2025 |
| SSC-CGL-TIER1-2025 | SSC CGL Tier 1 2025 |
| CBSE-CLASS10-2025 | CBSE Class 10 2025 |
| CBSE-CLASS12-2025 | CBSE Class 12 2025 |

---

### exam_question_map

```sql
CREATE TABLE exam_question_map (
  exam_id           VARCHAR(48)  REFERENCES exams(exam_id),
  qid               VARCHAR(32)  REFERENCES questions(qid),
  section           VARCHAR(64)  NOT NULL,    -- must match sections[].name in pattern
  marks_override    NUMERIC(4,2) DEFAULT NULL, -- overrides pattern marks if set
  neg_marks_override NUMERIC(4,2) DEFAULT NULL,
  q_type_override   VARCHAR(4)   DEFAULT NULL, -- override QID type for display
  scope             CHAR(1)      NOT NULL DEFAULT 'R', -- O=open R=restricted
  PRIMARY KEY (exam_id, qid)
);

CREATE INDEX idx_eqm_exam_id ON exam_question_map(exam_id);
CREATE INDEX idx_eqm_qid     ON exam_question_map(qid);
```

---

## ID Formats Summary

| Entity | Format | Example |
|---|---|---|
| category_id | 1–2 char code | `C`, `S`, `I` |
| board_id | ALLCAPS short code | `NTA`, `UPSC`, `CBSE` |
| pattern_id | `{EXAM_SHORT}-PAT-V{N}` | `JEE-MAIN-PAT-V3` |
| exam_id | `{BOARD}-{NAME}-{YEAR}[-{SESSION}]` | `NTA-JEE-MAIN-2025-JAN` |

---

## API Endpoints (Admin — Lambda-backed)

All admin endpoints require admin JWT. Served via CF Worker → Lambda invoke.

### Exam Categories

| Method | Path | Action |
|---|---|---|
| GET | `/admin/exam-categories` | List all categories |
| POST | `/admin/exam-categories` | Create category |
| PATCH | `/admin/exam-categories/:id` | Update category |
| DELETE | `/admin/exam-categories/:id` | Delete (blocked if exams reference it) |

### Exam Boards

| Method | Path | Action |
|---|---|---|
| GET | `/admin/exam-boards` | List all (filter: `?category_id=C`) |
| POST | `/admin/exam-boards` | Create board |
| PATCH | `/admin/exam-boards/:id` | Update board |
| DELETE | `/admin/exam-boards/:id` | Delete (blocked if exams reference it) |

### Exam Patterns

| Method | Path | Action |
|---|---|---|
| GET | `/admin/exam-patterns` | List all patterns |
| GET | `/admin/exam-patterns/:id` | Get pattern with full sections |
| POST | `/admin/exam-patterns` | Create pattern |
| PATCH | `/admin/exam-patterns/:id` | Update — triggers bundle rebuild if sections/marks change |
| DELETE | `/admin/exam-patterns/:id` | Delete (blocked if exams reference it) |

### Exams

| Method | Path | Action |
|---|---|---|
| GET | `/admin/exams` | List (filter: `?category=C&year=2025&board=NTA`) |
| GET | `/admin/exams/:id` | Get exam + pattern + question count |
| POST | `/admin/exams` | Create exam |
| PATCH | `/admin/exams/:id` | Update — pattern change triggers bundle rebuild |
| DELETE | `/admin/exams/:id` | Soft delete — sets `active=false`, `expiry_date=now` |

### Question Mapping

| Method | Path | Action |
|---|---|---|
| GET | `/admin/exams/:id/questions` | List mapped QIDs with section + marks |
| POST | `/admin/exams/:id/questions` | Map questions to exam (batch, up to 500 QIDs) |
| PATCH | `/admin/exams/:id/questions/:qid` | Update marks/scope for a mapped question |
| DELETE | `/admin/exams/:id/questions/:qid` | Remove QID from exam |
| POST | `/admin/exams/:id/rebuild-bundle` | Manual bundle rebuild trigger |

---

## Bundle Trigger Flow

Bundle is rebuilt when any of these change:

```
exam_patterns.sections updated  →  pattern.version++  →  trigger BS Lambda
exam_patterns.marks updated     →  pattern.version++  →  trigger BS Lambda
exam created                    →  trigger BS Lambda
questions mapped to exam        →  trigger BS Lambda (if > 10 new QIDs)
questions removed from exam     →  trigger BS Lambda
manual rebuild triggered        →  trigger BS Lambda always
```

BS Lambda flow on trigger:
```
1. Read exam + pattern from global DB
2. Read all QIDs from exam_question_map
3. Validate every QID format [!]
4. Build bundle JSON (DB records only — no content files)
5. Compute SHA-256
6. Write bundle to CCDN R2:  bundles/exam/{exam_id}/v{version}/bundle.json
7. Write manifest to CCDN R2: bundles/exam/{exam_id}/manifest.json
8. Set deprecated_flag=true on previous version manifest
```

Client behaviour on new bundle:
```
1. Client polls manifest on background sync
2. Detects version mismatch
3. Downloads new bundle
4. Verifies SHA-256 [!]
5. Swap deferred until active test session ends [!]
6. Deletes old bundle only after new bundle passes integrity check [!]
```

---

## Versioning Rules

| Event | Action |
|---|---|
| Pattern sections change | `pattern.version++`, bundle rebuild triggered |
| Pattern marks/neg change | `pattern.version++`, bundle rebuild triggered |
| Exam `expiry_date` passes | `deprecated_flag=true` on manifest; clients show "exam expired" |
| Question added to exam | bundle rebuild (deferred batch if < 10 QIDs) |
| Question removed from exam | bundle rebuild (immediate) |
| Scope change (O↔R) | bundle rebuild (immediate; affects which tenants can access) |

---

## Connections to Other Modules

| Module | How it uses Exam |
|---|---|
| Bundle Service (BS) | Reads `exams + exam_question_map` to build exam bundle |
| Bundle Access (BAS) | Validates `student_enrollment.exam_or_subject_id = exam_id` before serving bundle URL |
| Results (tenant DB) | Stores `exam_or_subject_id = exam_id` on every attempt |
| Test Runner (L08) | Reads sections from bundle manifest to enforce section timing + type rules |
| Score Calculator (L10) | Reads `marks_correct / marks_wrong` from bundle manifest per section |
| Exam Admin (L28) | Full CRUD + bundle rebuild trigger |
| Exam Calendar (L20) | Reads `exam_year + session + expiry_date` for calendar display |
| Cut-off Tracker (L10) | Groups results by `exam_id` for cut-off calculation |
| Board Score Predictor (L10) | Uses `exam_id + category_id` to select prediction model |

---

## Growth Mode Notes

| Phase | Exam module state |
|---|---|
| P0 Bootstrap | Manual admin via direct DB insert or simple admin script; no API layer yet |
| P1 Early Growth | Admin API deployed; bundle rebuild automated; 10–50 exams configured |
| P2 Growth | Full admin panel; bulk question mapping; pattern versioning active |
| P3 Scale | Multi-session exams; regional pattern variants; auto-expiry jobs |

---

## Validation Rules

- `exam_id` must be unique; once created never renamed (bundles reference it)
- `pattern_id` must exist before creating an exam
- `board_id` must match `category_id` of the exam's category
- `sections[].subject_code` must exist in `subjects` table
- `qid` in `exam_question_map` must exist in `questions` table
- `section` in `exam_question_map` must match one of `sections[].name` in the linked pattern
- Deleting a category/board/pattern is blocked if any exam references it
- `expiry_date` must be in the future at creation time
- BS rejects any malformed QID at bundle build time [!]
