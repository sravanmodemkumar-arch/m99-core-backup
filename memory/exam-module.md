---
name: Exam Module
description: Exam entity hierarchy, DB schema, ID formats, section JSONB, API endpoints, bundle trigger flow
type: project
---

# Exam Module — Memory

Full doc: `docs/exam-module.md`

## Entity Hierarchy
```
ExamCategory → ExamBoard → Exam → ExamPattern (sections JSONB)
                                → ExamQuestionMap (qid + marks per exam)
```

## ID Formats
| Entity | Format | Example |
|---|---|---|
| category_id | 1–2 char | `C`, `S`, `I` |
| board_id | ALLCAPS | `NTA`, `UPSC`, `CBSE` |
| pattern_id | `{NAME}-PAT-V{N}` | `JEE-MAIN-PAT-V3` |
| exam_id | `{BOARD}-{NAME}-{YEAR}[-{SESSION}]` | `NTA-JEE-MAIN-2025-JAN` |

## Key Rules
- All exam data lives in global DB only — tenants store exam_id reference [!]
- exam_id never renamed after creation (bundles reference it)
- Pattern change → version++ → BS bundle rebuild triggered
- BS rejects malformed QIDs at build [!]
- Bundle swap deferred until active test session ends [!]
- section in exam_question_map must match sections[].name in pattern

## Section JSONB fields
`name, subject_code, q_count, marks_correct, marks_wrong, marks_partial, type_allowed, optional_q, duration_min`

## Bundle Trigger Events
Pattern sections/marks change | exam created | questions mapped/removed | manual rebuild

## Growth Mode
- P0: manual DB insert
- P1: admin API live
- P2: full admin panel + bulk mapping
- P3: multi-session + auto-expiry
