# Question Schema v1.4.0
# Covers: School | Intermediate | JEE | NEET | UPSC | SSC | RRB | Banking | GATE | CA | Olympiad | Board | Language | Descriptive

---

## Changelog

| Version | Changes |
|---|---|
| v1.4.0 | Added type codes E, L, G, U, O, V; added `marking`, `wt`, `tags` fields to content file; updated content-by-type table |
| v1.3.0 | Initial published version |

---

## QID Format

```
MATH-03-02-S-M-C-000123
│    │  │  │ │ │ │
│    │  │  │ │ │ └── sequence   6 digits; auto-increment per subtopic
│    │  │  │ │ └──── exam_cat   S=school I=intermediate C=competitive D=degree B=school+intermediate A=all
│    │  │  │ └─────── difficulty E=easy M=medium H=hard X=expert
│    │  │  └────────── type      see type codes below
│    │  └───────────── subtopic  2 digits
│    └──────────────── topic     2 digits
└───────────────────── subject   4 chars
```

### QID tells — zero extra DB fields needed

| Info | From QID |
|---|---|
| subject | prefix (MATH, PHY, CHEM, ENG, HIST, GEO, ECO, POL, BIO, CS) |
| topic_id | positions 2 (03) |
| subtopic_id | position 3 (02) |
| question_type | type code (S, M, N ...) |
| difficulty | difficulty code (E, M, H, X) |
| exam_category | cat code (S, I, C, D, B, A) |
| content_path | r2://global/q/{qid}.json |
| solution_path | r2://global/sol/{qid}.json |
| is_hots | difficulty = X |
| marks | exam_map (per exam, not per question) |
| neg_marks | exam_map (per exam) |
| class_levels | subject_master join on subtopic_id |
| is_pyq | exam_map join |

---

## Type Codes

```
S = mcq_single          M = mcq_multiple
N = numerical           B = fill_blank
T = true_false          C = match_column
A = assertion_reason    K = statement_based
Q = sequence_order      X = matrix_match
P = passage_based       J = subjective
D = descriptive         R = data_sufficiency

── v1.4.0 additions ─────────────────────────
E = case_study          (CBSE new pattern, UPSC GS, MBA — data + charts + reasoning combined)
L = cloze_test          (Banking, SSC English, CAT VARC — paragraph with multiple blanks)
G = graph_based         (Physics, Geography, Biology — diagram/graph interaction)
U = multi_linked        (JEE Advanced integer+MCQ linked; case-based numericals)
O = code_output         (CS, GATE, placements — predict or trace code output)
V = audio_based         (Language exams, IELTS-type — listening/spoken comprehension)
```

## Difficulty Codes

```
E = easy   M = medium   H = hard   X = expert
```

## Exam Category Codes

```
S = school only
I = intermediate only
C = competitive only
D = degree only
B = school + intermediate
A = all categories
```

## Scope Codes

```
O = open        (any exam can use)
R = restricted  (exam_map controls access)
```

---

## DB Record — ~80 bytes per question

```json
{
  "qid": "MATH-03-02-S-M-C-000123",
  "v": 3,
  "scope": "O",
  "langs": ["en","hi","te"],
  "yt": true,
  "offline": true
}
```

**1L questions = ~8 MB per subject in DB**
**20 subjects = ~160 MB total**

### DB fields explained

| Field | Purpose | Cannot derive from QID |
|---|---|---|
| v | version; validates content file freshness | yes |
| scope | O=open R=restricted; access control at BAS | yes |
| langs | needed at bundle-build time before content loads | yes |
| yt | client shows video thumbnail before content loads | yes |
| offline | whether question available offline in bundle | yes |

---

## R2 Content File — ~800 bytes, loaded on question open

Path built from QID: `r2://global/q/{qid}.json`

```json
{
  "qid": "MATH-03-02-S-M-C-000123",
  "v": 3,
  "instr": "Choose the correct option.",
  "body": [
    { "t": "tx", "v": "If the roots of" },
    { "t": "mx", "v": "ax^2+bx+c=0" },
    { "t": "tx", "v": "are equal then:" }
  ],
  "opts": [
    { "id": "A", "t": "mx", "v": "b^2-4ac>0" },
    { "id": "B", "t": "mx", "v": "b^2-4ac=0" },
    { "id": "C", "t": "mx", "v": "b^2-4ac<0" },
    { "id": "D", "t": "tx", "v": "Cannot be determined" }
  ],
  "ans": ["B"],
  "marking": {
    "correct": 4,
    "partial": 2,
    "wrong": -1
  },
  "wt": 1.2,
  "tags": ["quadratic", "roots", "discriminant"],
  "yt": { "vid": "abc123", "ts": 0, "lang": "en", "fb": null },
  "hints": [
    { "l": 1, "p": 0.0, "v": "Think about equal roots condition." },
    { "l": 2, "p": 0.25, "t": "mx", "v": "D = b^2 - 4ac" }
  ],
  "media": [],
  "tr": {
    "hi": {
      "instr": "सही विकल्प चुनें।",
      "body": [
        { "t": "tx", "v": "यदि समीकरण" },
        { "t": "mx", "v": "ax^2+bx+c=0" },
        { "t": "tx", "v": "के मूल समान हैं:" }
      ],
      "opts": [
        { "id": "A", "v": "b^2-4ac>0" },
        { "id": "B", "v": "b^2-4ac=0" },
        { "id": "C", "v": "b^2-4ac<0" },
        { "id": "D", "v": "निर्धारित नहीं" }
      ]
    }
  }
}
```

### New content fields (v1.4.0)

| Field | Type | Purpose | Required |
|---|---|---|---|
| `marking` | object | Per-question partial marking; overrides exam-level defaults when present | No |
| `marking.correct` | number | Marks awarded for correct answer | — |
| `marking.partial` | number | Marks for partially correct (JEE Advanced, matrix match) | — |
| `marking.wrong` | number | Negative marks for wrong answer | — |
| `wt` | float | Difficulty weight for adaptive scoring and analytics (e.g. 1.2) | No |
| `tags` | string[] | Topic/concept tags for filtering and recommendations | No |

### Content file by type — what changes

| Type | body | opts | ans | extra fields |
|---|---|---|---|---|
| mcq_single (S) | blocks | 4 options | ["B"] | — |
| mcq_multiple (M) | blocks | 4+ options | ["A","C"] | min_sel, max_sel |
| numerical (N) | blocks | none | num value | unit, range, sig_fig |
| fill_blank (B) | blocks+blanks | none | {B1:"photosynthesis"} | case_sensitive |
| true_false (T) | blocks | none | true/false | — |
| match_column (C) | col_a, col_b | none | {A1:"B2",...} | — |
| assertion_reason (A) | assertion, reason | std 4 opts | ["A"] | — |
| statement_based (K) | blocks, stmts | std opts | {correct:["S1","S2"]} | — |
| sequence_order (Q) | blocks, items | none | ["S3","S1","S4","S2"] | — |
| matrix_match (X) | matrix rows/cols | none | {P:["2","3"],...} | — |
| passage_based (P) | passage + sub_q | per sub_q | per sub_q | sub_questions[] |
| subjective (J) | blocks | none | keywords[], rubric[] | word_limit, model_ans |
| descriptive (D) | prompt | none | keywords[], rubric[] | word_limit |
| data_sufficiency (R) | blocks, stmts | std 4 opts | ["A"] | — |
| case_study (E) | blocks, data, charts, context | mixed (per sub_q) | per sub_q | sub_questions[], data_tables[], charts[] |
| cloze_test (L) | paragraph with blk tokens | none | {B1:"word",...} | case_sensitive, word_bank[] |
| graph_based (G) | blocks + graph_ref | none or opts | varies by subtype | graph_type, interaction, axes |
| multi_linked (U) | shared_stem + sub_q[] | per sub_q | per sub_q | sub_questions[], link_logic |
| code_output (O) | code block + prompt | none or opts | expected_output | lang, stdin, time_limit_ms |
| audio_based (V) | prompt | none or opts | varies | audio_ref, transcript (admin only) |

---

## R2 Solution File — ~300 bytes, loaded only after submit

Path built from QID: `r2://global/sol/{qid}.json`

```json
{
  "qid": "MATH-03-02-S-M-C-000123",
  "v": 3,
  "summary": "D=0 for equal roots.",
  "steps": [
    { "s": 1, "v": "D = b²-4ac" },
    { "s": 2, "t": "mx", "v": "b^2-4ac=0" }
  ],
  "shortcut": "D=0 equal | D>0 distinct | D<0 imaginary",
  "mistake": "Confusing D>0 with D=0",
  "yt_sol": { "vid": "sol123", "ts": 0 },
  "ref": { "book": "NCERT 10", "ch": 4, "pg": 76 },
  "tr": {
    "hi": {
      "summary": "समान मूलों के लिए D=0।",
      "steps": [
        { "s": 1, "v": "D = b²-4ac" },
        { "s": 2, "v": "समान मूल → D=0" }
      ]
    }
  }
}
```

---

## Block Type Codes (content + solution files)

```
tx  = text
mx  = math LaTeX inline
mxb = math LaTeX block
img = image ref
tbl = table ref
cht = chart ref
aud = audio ref
cod = code block
blk = blank placeholder
```

---

## Load Strategy

| Event | What loads | Bytes |
|---|---|---|
| Bundle build (BS) | DB record only | ~80 |
| Test start | DB records batch | ~80 × N |
| Question open | R2 content file | ~800 |
| After submit | R2 solution file | ~300 |
| Admin panel | DB + content + solution + meta | full |

---

## Separate Reference Files (admin only, never student)

```
r2://global/ref/exam-map.json        → exam → qid mappings + marks per exam
r2://global/ref/analytics.json       → accuracy, time, per-option stats
r2://global/ref/meta.json            → source, legal, print, dispute flags
r2://global/ref/accessibility.json   → WCAG, screen reader, time extension
r2://global/ref/gamification.json    → XP, badge triggers per qid
r2://global/ref/collaboration.json   → workflow, review, approval status
r2://global/ref/versioning.json      → changelog, rollback snapshots
r2://global/ref/content-flags.json   → sensitivity, age, region restrictions
```

---

## Size Summary

| Approach | Per question | 1L questions | 20 subjects |
|---|---|---|---|
| Original full JSON | ~15 KB | 1.5 GB | 30 GB |
| DB + content + solution | ~1.2 KB | 120 MB | 2.4 GB |
| DB record only | ~80 bytes | 8 MB | 160 MB |

---

## Subject Codes

```
MATH = Mathematics        PHY  = Physics
CHEM = Chemistry          BIO  = Biology
ENG  = English            HIST = History
GEO  = Geography          ECO  = Economics
POL  = Political Science  CS   = Computer Science
REAS = Reasoning          CURR = Current Affairs
GK   = General Knowledge  ACC  = Accountancy
BUS  = Business Studies   SANS = Sanskrit
URDU = Urdu               FREN = French
ENV  = Environment        PSY  = Psychology
```
