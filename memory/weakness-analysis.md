# Weakness Analysis

## Hierarchy

Subject → Topic → Subtopic (3 levels)

## Calculation (CGS Lambda)

```sql
-- JOIN tenant.results + global.questions on qid
subtopic_score = AVG(score) WHERE subtopic_id = X AND UID = Y
topic_score    = AVG(subtopic_scores for that topic)
subject_score  = AVG(topic_scores for that subject)
weakness_score = 100 - accuracy%
rank           = ASC (lowest score = weakest)
```

- Topic score only from attempted subtopics; never assume 0 for untouched [!]
- Weakness score shown only when status = ready [!]
- no_data ≠ score of 0% [!]

## Status States

| Status | Condition | Display |
|---|---|---|
| no_data | 0 attempts | Grey; "Not started"; no score shown |
| partial | attempt_count < 3 | Show subtopics; "Need X more" |
| ready | attempt_count >= 3 | Full bar + colour |

## Colour Coding (status = ready)

| Score | Colour |
|---|---|
| < 60% | Red |
| 60–74% | Amber |
| >= 75% | Green |

"Focus here" badge shown on the bottom 2 topics per subject.

## Storage

Stored in `weakness_snapshot` table in tenant DB:

```
(UID, subject→topic→subtopic accuracy JSON, status, attempt_count, last_calculated_at)
```

CGS updates weakness_snapshot only after confirmed tenant PG write [!].  
Weakness snapshot is never deleted by log clearing [!].
