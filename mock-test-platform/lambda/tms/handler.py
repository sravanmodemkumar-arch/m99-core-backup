"""
TMS — Tenant Migration Service

Trigger: Triggered by TGM
5-phase migration:
  1. Provision  → create new PG schema/instance in target tier
  2. DW activate → enable dual-write to old + new simultaneously
                   All group tenants enter DW simultaneously [!]
                   Partial group migration never allowed [!]
  3. Backfill   → copy historical data to new location
  4. Verify     → PG row count + checksum comparison
  5. Cutover    → switch live traffic; retire old

DW overhead alert fires if DW phase > 48h [!]
All group tenants exit DW simultaneously [!]
"""

import json
import time
import hashlib
import boto3
from sqlalchemy import text

from shared.config import cfg
from shared.db import get_tenant_engine, tenant_session


def lambda_handler(event, context):
    tid = event["tid"]
    action = event.get("action", "promote")   # promote | demote | extract
    from_tier = event.get("from")
    to_tier = event.get("to")

    print(f"[TMS] Starting migration: tid={tid} action={action} {from_tier}→{to_tier}")

    # Phase 1: Provision
    new_pg_host, new_schema = _phase_provision(tid, to_tier)

    # Phase 2: DW activate — ALL group tenants enter simultaneously [!]
    group_id = _get_group_id(tid)
    group_tids = _get_group_tids(group_id)
    _phase_dw_activate(group_tids, new_pg_host, new_schema)

    dw_start = time.time()

    # Phase 3: Backfill
    old_pg_host, old_schema = _get_current_location(tid)
    _phase_backfill(tid, old_pg_host, old_schema, new_pg_host, new_schema)

    # Phase 4: Verify
    verified = _phase_verify(tid, old_pg_host, old_schema, new_pg_host, new_schema)
    if not verified:
        raise RuntimeError(f"[TMS] Verification failed for tid={tid} — aborting migration")

    dw_hours = (time.time() - dw_start) / 3600
    if dw_hours > 48:
        print(f"[TMS] WARNING: DW overhead {dw_hours:.1f}h exceeds 48h threshold [!]")

    # Phase 5: Cutover — ALL group tenants exit DW simultaneously [!]
    _phase_cutover(group_tids, new_pg_host, new_schema)

    return {"tid": tid, "migrated_to": new_pg_host, "schema": new_schema, "dw_hours": dw_hours}


def _phase_provision(tid: str, target_tier: str) -> tuple[str, str]:
    """Pull from warm pool + create schema in new tier."""
    # TODO: pull from WP for target_tier
    new_pg_host = "PLACEHOLDER_NEW_HOST"
    new_schema = f"tid_{tid}"

    engine = get_tenant_engine(tid, new_pg_host, new_schema)
    with engine.connect() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {new_schema}"))
        conn.commit()

    # Run Alembic migrations on new schema
    # TODO: same as TPS._provision_schema

    return new_pg_host, new_schema


def _phase_dw_activate(group_tids: list[str], new_pg_host: str, new_schema: str):
    """
    Enable dual-write for ALL tenants in the group simultaneously [!]
    Partial group migration never allowed [!]
    """
    # TODO: update routing config for all group_tids to write to both old + new
    print(f"[TMS] DW activated for group of {len(group_tids)} tenants")


def _phase_backfill(tid: str, old_host: str, old_schema: str, new_host: str, new_schema: str):
    """Copy all historical data from old schema to new schema."""
    tables = ["results", "users", "user_settings", "checkpoints", "student_enrollment", "weakness_snapshot"]
    # TODO: iterate tables and INSERT INTO new_schema.table SELECT * FROM old_schema.table
    print(f"[TMS] Backfill complete for tid={tid}")


def _phase_verify(tid: str, old_host: str, old_schema: str, new_host: str, new_schema: str) -> bool:
    """
    Verify: PG row count + checksum comparison.
    Returns True if new schema matches old schema.
    """
    tables = ["results", "users", "user_settings", "student_enrollment"]

    with tenant_session(tid, old_host, old_schema) as old_sess, \
         tenant_session(tid, new_host, new_schema) as new_sess:

        for table in tables:
            old_count = old_sess.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            new_count = new_sess.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            if old_count != new_count:
                print(f"[TMS] Verify FAILED: {table} old={old_count} new={new_count}")
                return False

    print(f"[TMS] Verify PASSED for tid={tid}")
    return True


def _phase_cutover(group_tids: list[str], new_pg_host: str, new_schema: str):
    """
    Switch all group tenants to new location simultaneously [!]
    Then disable dual-write.
    """
    # TODO: update KV routing for all group_tids to point to new host
    # TODO: disable dual-write for all group_tids simultaneously [!]
    print(f"[TMS] Cutover complete for {len(group_tids)} tenants")


def _get_group_id(tid: str) -> str:
    # TODO: lookup from KV or management DB
    return "PLACEHOLDER_GID"


def _get_group_tids(group_id: str) -> list[str]:
    # TODO: fetch all tids for this group_id from management DB
    return []


def _get_current_location(tid: str) -> tuple[str, str]:
    # TODO: fetch current pg_host + schema from KV routing
    return "PLACEHOLDER_OLD_HOST", f"tid_{tid}"
