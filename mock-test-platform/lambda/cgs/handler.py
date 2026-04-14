"""
CGS — Content Gen Service

Trigger: EPS only, after confirmed DB write [!]
Flow:
  1. JOIN tenant.results + global.questions on qid
  2. Compute weakness snapshot (subject → topic → subtopic)
  3. Update weakness_snapshot in tenant PG
  4. Push updated snapshot to CCDN R2

Weakness scoring:
  subtopic_score = AVG(score) WHERE subtopic_id = X AND uid = Y
  topic_score    = AVG(subtopic_scores for topic)
  subject_score  = AVG(topic_scores for subject)
  weakness_score = 100 - accuracy%

Status:
  no_data  → 0 attempts           (never show score, show grey) [!]
  partial  → attempt_count < 3    (show "need X more")
  ready    → attempt_count >= 3   (show full bar + colour)

Topic score only from attempted subtopics; never assume 0 for untouched [!]
CCDN updated only after confirmed tenant PG write [!]
"""

import json
import math
import boto3
from sqlalchemy import text

from shared.config import cfg
from shared.db import tenant_session, global_session
from shared.models import WeaknessSnapshot


def lambda_handler(event, context):
    tid = event["tid"]
    s3 = boto3.client("s3")

    # TODO: resolve pg_host + schema from internal lookup
    pg_host = cfg.TENANT_RP_HOST_A
    schema = f"tid_{tid}"

    # 1. Fetch all results for this tenant, joined with global question hierarchy
    results = _fetch_joined_results(tid, pg_host, schema)

    # 2. Compute weakness snapshots per user
    user_snapshots = _compute_snapshots(results)

    # 3. Write to tenant PG + push to CCDN
    with tenant_session(tid, pg_host, schema) as session:
        for uid, snapshot_data in user_snapshots.items():
            _upsert_snapshot(session, uid, snapshot_data)
        session.commit()  # confirmed write first [!]

        # 4. Push to CCDN only after confirmed PG write [!]
        for uid, snapshot_data in user_snapshots.items():
            _push_to_ccdn(s3, tid, uid, snapshot_data)

    return {"tid": tid, "users_updated": len(user_snapshots)}


def _fetch_joined_results(tid: str, pg_host: str, schema: str) -> list[dict]:
    """
    JOIN tenant.results + global.questions on qid
    Uses both global session (read question hierarchy) and tenant session (read results)
    """
    # Fetch from tenant DB
    with tenant_session(tid, pg_host, schema) as t_session:
        rows = t_session.execute(
            text("""
                SELECT uid, qid, score, attempt_no, timestamp
                FROM results
                ORDER BY uid, qid, attempt_no
            """)
        ).fetchall()

    return [dict(r._mapping) for r in rows]


def _compute_snapshots(results: list[dict]) -> dict:
    """
    Returns: { uid: { accuracy_map, status, attempt_count } }

    QID encodes subject+topic+subtopic — parsed to build hierarchy.
    e.g. MATH-03-02-S-M-C-000123 → subject=MATH, topic=03, subtopic=02
    """
    from collections import defaultdict

    # uid → subject → topic → subtopic → [scores]
    acc: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    attempt_counts: dict[str, int] = defaultdict(int)

    for row in results:
        uid = row["uid"]
        qid = row["qid"]
        score = row["score"] or 0

        parts = qid.split("-")
        if len(parts) < 7:
            continue  # malformed QID — skip

        subject = parts[0]
        topic = parts[1]
        subtopic = parts[2]

        acc[uid][subject][topic][subtopic].append(score)
        attempt_counts[uid] += 1

    snapshots = {}
    for uid, subjects in acc.items():
        accuracy_map = {}
        for subject, topics in subjects.items():
            accuracy_map[subject] = {}
            for topic, subtopics in topics.items():
                accuracy_map[subject][topic] = {}
                for subtopic, scores in subtopics.items():
                    # Only from attempted subtopics; never assume 0 for untouched [!]
                    accuracy_map[subject][topic][subtopic] = sum(scores) / len(scores)

        total_attempts = attempt_counts[uid]
        if total_attempts == 0:
            status = "no_data"
        elif total_attempts < 3:
            status = "partial"
        else:
            status = "ready"

        snapshots[uid] = {
            "accuracy_map": accuracy_map,
            "status": status,
            "attempt_count": total_attempts,
        }

    return snapshots


def _upsert_snapshot(session, uid: str, data: dict):
    import time
    snap = session.get(WeaknessSnapshot, uid)
    if snap:
        snap.accuracy_map = data["accuracy_map"]
        snap.status = data["status"]
        snap.attempt_count = data["attempt_count"]
        snap.last_calculated_at = int(time.time())
    else:
        session.add(WeaknessSnapshot(
            uid=uid,
            accuracy_map=data["accuracy_map"],
            status=data["status"],
            attempt_count=data["attempt_count"],
            last_calculated_at=int(time.time()),
        ))


def _push_to_ccdn(s3, tid: str, uid: str, data: dict):
    """Push weakness snapshot to CCDN R2 [!] only after confirmed PG write."""
    key = f"weakness/{tid}/{uid}.json"
    s3.put_object(
        Bucket=cfg.CCDN_BUCKET,
        Key=key,
        Body=json.dumps(data),
        ContentType="application/json",
    )
