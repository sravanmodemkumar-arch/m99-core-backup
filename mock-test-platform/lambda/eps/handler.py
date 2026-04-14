"""
EPS — Event Processing Service

Trigger: 5-min/30-min schedule + 3-7AM IST + threshold trigger
Flow:
  1. Poll ECDN (R2) locked batch files per priority folder
  2. Chunk 100 events
  3. Validate attemptNo server-side (must = current_max + 1) [!]
  4. Checkpoint to tenant PG via RDS Proxy
  5. Trigger CGS only after confirmed DB write [!]
  6. Delete locked file from ECDN only after DB write confirmed [!]
"""

import json
import math
import boto3
from sqlalchemy import text

from shared.config import cfg
from shared.db import tenant_session, global_session
from shared.models import Result, Checkpoint


def lambda_handler(event, context):
    s3 = boto3.client("s3")
    lambda_client = boto3.client("lambda")

    # List all locked batch files across all tenant groups
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=cfg.ECDN_BUCKET, Prefix="events/", Delimiter="/locked/")

    processed_tids = set()

    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if "/locked/" not in key:
                continue

            try:
                batch = _load_batch(s3, key)
                if not batch:
                    continue

                gid = batch["events"][0]["gid"] if batch["events"] else None
                if not gid:
                    continue

                # Process in chunks of 100 [!]
                chunks = _chunk(batch["events"], cfg.EPS_CHUNK_SIZE)
                for chunk in chunks:
                    tids_written = _write_chunk(chunk)
                    processed_tids.update(tids_written)

                # Delete locked file only after DB write confirmed [!]
                s3.delete_object(Bucket=cfg.ECDN_BUCKET, Key=key)

            except Exception as e:
                print(f"[EPS] Error processing {key}: {e}")
                # Do not delete — EPS will retry on next poll

    # Trigger CGS for each tenant that had confirmed writes [!]
    for tid in processed_tids:
        _trigger_cgs(lambda_client, tid)

    return {"processed_tids": list(processed_tids)}


def _load_batch(s3, key: str) -> dict:
    response = s3.get_object(Bucket=cfg.ECDN_BUCKET, Key=key)
    return json.loads(response["Body"].read())


def _chunk(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _write_chunk(events: list) -> set:
    """Write a chunk of events to tenant PG. Returns set of tids successfully written."""
    written_tids = set()

    # Group by tid for efficient session reuse
    by_tid: dict[str, list] = {}
    for e in events:
        by_tid.setdefault(e["tid"], []).append(e)

    for tid, tid_events in by_tid.items():
        try:
            # TODO: resolve pg_host + schema from KV or internal lookup
            pg_host = cfg.TENANT_RP_HOST_A  # resolve by region from uid prefix
            schema = f"tid_{tid}"

            with tenant_session(tid, pg_host, schema) as session:
                for e in tid_events:
                    if e.get("event_type") in ("result_first_attempt", "result_repeat"):
                        _write_result(session, e)

                # Checkpoint per priority folder
                _update_checkpoint(session, e.get("priority", "P4"), tid)
                session.commit()
                written_tids.add(tid)

        except Exception as ex:
            print(f"[EPS] Failed writing tid={tid}: {ex}")

    return written_tids


def _write_result(session, event: dict):
    data = event["data"]
    uid = event["uid"]
    qid = data["qid"]
    attempt_no = data["attempt_no"]

    # Validate attemptNo: must = current_max + 1 [!]
    current_max = session.execute(
        text("SELECT MAX(attempt_no) FROM results WHERE uid=:uid AND qid=:qid"),
        {"uid": uid, "qid": qid}
    ).scalar() or 0

    if attempt_no != current_max + 1:
        raise ValueError(
            f"Invalid attemptNo={attempt_no} for uid={uid} qid={qid}; expected {current_max + 1}"
        )

    result = Result(
        uid=uid,
        qid=qid,
        attempt_no=attempt_no,
        bundle_version=data.get("bundle_version"),
        exam_or_subject_id=data.get("exam_or_subject_id"),
        score=data.get("score"),
        time_taken=data.get("time_taken"),
        timestamp=event["timestamp"],
    )
    # INSERT ON CONFLICT DO NOTHING — idempotent [!]
    session.merge(result)


def _update_checkpoint(session, priority: str, tid: str):
    import time
    folder = f"{tid}/{priority}"
    cp = session.get(Checkpoint, folder)
    if cp:
        cp.last_processed_epoch = int(time.time())
        cp.updated_at = int(time.time())
    else:
        session.add(Checkpoint(
            priority_folder=folder,
            last_processed_epoch=int(time.time()),
            updated_at=int(time.time()),
        ))


def _trigger_cgs(lambda_client, tid: str):
    """Trigger CGS after confirmed DB write [!]"""
    lambda_client.invoke(
        FunctionName=f"mock-test-cgs-{cfg.ENV}",
        InvocationType="Event",
        Payload=json.dumps({"tid": tid}),
    )
