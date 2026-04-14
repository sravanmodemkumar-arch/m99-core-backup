# Non-Negotiable Rules [!]

All 22 rules from the platform spec. Violating any of these is a critical bug.

| # | Rule |
|---|---|
| 1 | DO writes every event to R2 immediately on arrival (crash = zero loss) |
| 2 | Batch file never deleted until DB write is fully confirmed |
| 3 | Settings update count enforced server-side only in tenant PG |
| 4 | attemptNo validated server-side in EPS (must = current_max + 1) |
| 5 | CCDN updated by CGS only after confirmed tenant PG write |
| 6 | pA stored as absolute UTC epoch; no timezone logic in processing engine |
| 7 | Fan-out threshold = deployment config; never hardcoded |
| 8 | BAS validates enrollment before serving any bundle URL |
| 9 | Bundle swap never interrupts active test session |
| 10 | Group promotion uses 5/7 rolling window |
| 11 | GID always set by admin at provisioning; system never auto-assigns |
| 12 | All group tenants enter + exit dual-write (DW) simultaneously |
| 13 | QID encodes subject+topic+subtopic+type+difficulty+exam_cat; BS rejects malformed at build |
| 14 | DB stores only: qid, v, scope, langs, yt, offline — everything else derived from QID or R2 |
| 15 | Content file loaded from R2 on question open; solution file loaded only after submit |
| 16 (a) | Weakness score shown only when status = ready; no_data ≠ score of 0% |
| 16 (b) | Topic score only from attempted subtopics; never assume 0 for untouched |
| 17 | Log clearing never touches active results, in-retention rows, WS, active bundles, enrollment, global DB |
| 18 | RC (retention config) = deployment config; never hardcoded; clear operation is idempotent |
| 19 | All Lambda→RDS connections via RDS Proxy only; never direct |
| 20 | Questions/subjects/exams in global schema only; never duplicated per tenant |
| 21 | Tenant schema stores qid reference only; never question content |
| 22 | CF Workers never access global schema |
| 23 | BS reads global schema; writes manifests to R2 only |

## Quick Reference by Category

**Data integrity:**  1, 2, 4, 5

**Encryption + auth:**  3, 8, 11

**Offline + bundles:**  9, 13, 14, 15

**DB isolation:**  19, 20, 21, 22, 23

**Tenant + group:**  10, 11, 12

**Analytics correctness:**  16a, 16b

**Config vs hardcode:**  6, 7, 18

**Log safety:**  17
