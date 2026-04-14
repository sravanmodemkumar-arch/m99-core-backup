"""
BS — Bundle Service

Trigger: notification-driven (exam pattern change) / monthly (subject)
Flow:
  1. Read questions from global DB (via global RDS Proxy)
  2. Filter by exam/subject + scope + offline flag
  3. Validate QIDs — reject malformed at build [!]
  4. Build bundle manifest with SHA-256
  5. Write bundle + manifest to CCDN R2

QID must be on every question in bundle [!]
BS reads global schema; writes manifests to R2 only [!]
"""

import json
import hashlib
import time
import boto3
from sqlalchemy import text

from shared.config import cfg
from shared.db import global_session
from shared.models import Question, ExamQuestionMap


QID_PATTERN_PARTS = 7  # MATH-03-02-S-M-C-000123 → 7 parts when split by "-"


def lambda_handler(event, context):
    s3 = boto3.client("s3")
    bundle_type = event.get("bundle_type")  # "exam" or "subject"
    entity_id = event.get("entity_id")      # exam_id or subject_code

    if not bundle_type or not entity_id:
        raise ValueError("bundle_type and entity_id are required")

    if bundle_type == "exam":
        questions = _load_exam_questions(entity_id)
    elif bundle_type == "subject":
        questions = _load_subject_questions(entity_id)
    else:
        raise ValueError(f"Unknown bundle_type: {bundle_type}")

    # Validate all QIDs — reject malformed [!]
    for q in questions:
        _validate_qid(q["qid"])

    # Build bundle
    bundle_content = _build_bundle(questions)
    sha256 = _sha256(bundle_content)

    version = int(time.time())
    manifest = {
        "bundle_type": bundle_type,
        "entity_id": entity_id,
        "version": version,
        "sha256": sha256,
        "size": len(bundle_content),
        "release_date": version,
        "expiry_date": None,
        "deprecated_flag": False,
        "question_count": len(questions),
    }

    # Write bundle + manifest to CCDN R2
    bundle_key = f"bundles/{bundle_type}/{entity_id}/v{version}/bundle.json"
    manifest_key = f"bundles/{bundle_type}/{entity_id}/manifest.json"

    s3.put_object(Bucket=cfg.CCDN_BUCKET, Key=bundle_key,
                  Body=bundle_content, ContentType="application/json")
    s3.put_object(Bucket=cfg.CCDN_BUCKET, Key=manifest_key,
                  Body=json.dumps(manifest), ContentType="application/json")

    return {"bundle_key": bundle_key, "manifest_key": manifest_key, "sha256": sha256}


def _load_exam_questions(exam_id: str) -> list[dict]:
    """Read from global schema via global RDS Proxy [!]"""
    with global_session() as session:
        rows = session.execute(
            text("""
                SELECT q.qid, q.v, q.scope, q.langs, q.yt, q.offline,
                       eqm.marks, eqm.neg_marks, eqm.section
                FROM questions q
                JOIN exam_question_map eqm ON eqm.qid = q.qid
                WHERE eqm.exam_id = :exam_id
                  AND q.offline = true
                ORDER BY eqm.section, q.qid
            """),
            {"exam_id": exam_id}
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def _load_subject_questions(subject_code: str) -> list[dict]:
    """Read from global schema — filter by subject prefix in QID"""
    with global_session() as session:
        rows = session.execute(
            text("""
                SELECT qid, v, scope, langs, yt, offline
                FROM questions
                WHERE qid LIKE :prefix
                  AND offline = true
                  AND scope = 'O'
                ORDER BY qid
            """),
            {"prefix": f"{subject_code}-%"}
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def _validate_qid(qid: str):
    """BS rejects malformed QIDs at build [!]"""
    parts = qid.split("-")
    if len(parts) != QID_PATTERN_PARTS:
        raise ValueError(f"Malformed QID (expected {QID_PATTERN_PARTS} parts): {qid}")
    subject, topic, subtopic, q_type, difficulty, exam_cat, seq = parts
    if len(subject) < 2 or len(subject) > 8:
        raise ValueError(f"Invalid subject in QID: {qid}")
    if not topic.isdigit() or not subtopic.isdigit():
        raise ValueError(f"Invalid topic/subtopic in QID: {qid}")
    if difficulty not in ("E", "M", "H", "X"):
        raise ValueError(f"Invalid difficulty in QID: {qid}")
    if exam_cat not in ("S", "I", "C", "D", "B", "A"):
        raise ValueError(f"Invalid exam_cat in QID: {qid}")
    if not seq.isdigit() or len(seq) != 6:
        raise ValueError(f"Invalid sequence in QID: {qid}")


def _build_bundle(questions: list[dict]) -> bytes:
    """
    Bundle = list of DB records (qid + metadata).
    Content files are NOT included here — loaded from R2 on question open [!]
    """
    bundle = {
        "questions": [
            {
                "qid": q["qid"],          # QID on every question [!]
                "v": q["v"],
                "scope": q["scope"],
                "langs": q["langs"],
                "yt": q["yt"],
                "offline": q["offline"],
            }
            for q in questions
        ]
    }
    return json.dumps(bundle).encode("utf-8")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
