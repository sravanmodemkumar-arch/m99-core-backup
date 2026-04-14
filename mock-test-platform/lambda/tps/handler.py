"""
TPS — Tenant Provisioning Service

Trigger: On-demand admin call
Flow (fully automated, zero code changes per new tenant):
  1. Pull pre-provisioned instance from Warm Pool (WP)
  2. Provision PG schema (tid_xxxx)
  3. Run Alembic migrations
  4. Create R2 folders (ECDN + CCDN)
  5. Register routing in KV
  6. Generate enc_secret (32-byte hex), store in tenant PG + Secrets Manager
  7. Deploy initial bundle

GID always set by admin at provisioning; system never auto-assigns [!]
"""

import json
import os
import secrets
import subprocess
import boto3
from sqlalchemy import text

from shared.config import cfg
from shared.db import get_tenant_engine, tenant_session


def lambda_handler(event, context):
    tid = event["tid"]
    gid = event["gid"]               # set by admin [!]
    bundle_strategy = event.get("bundle_strategy", "exam")
    exam_subject_config = event.get("exam_subject_config", {})

    if not tid or not gid:
        raise ValueError("tid and gid are required; gid must be set by admin [!]")

    s3 = boto3.client("s3")
    secrets_client = boto3.client("secretsmanager")

    # 1. Pull from Warm Pool — get pre-provisioned PG instance
    pg_host, tier = _pull_from_warm_pool()

    schema = f"tid_{tid}"

    # 2 + 3. Provision PG schema + run Alembic migrations
    _provision_schema(tid, pg_host, schema)

    # 4. Create R2 folders (ECDN + CCDN)
    _create_r2_folders(s3, tid)

    # 5. Register routing in KV (via CF API, or write to a bootstrap R2 file picked up by Worker)
    routing = {
        "pg_host": pg_host,
        "schema": schema,
        "group_id": gid,
        "tier": tier,
    }
    _register_kv_routing(tid, routing, s3)

    # 6. Generate enc_secret — 32-byte hex [!]
    enc_secret = secrets.token_hex(32)
    _store_enc_secret(tid, enc_secret, secrets_client)
    _write_enc_secret_to_db(tid, pg_host, schema, enc_secret)

    # 7. Trigger initial bundle build
    _trigger_initial_bundle(tid, bundle_strategy, exam_subject_config)

    return {
        "tid": tid,
        "gid": gid,
        "pg_host": pg_host,
        "tier": tier,
        "schema": schema,
    }


def _pull_from_warm_pool() -> tuple[str, str]:
    """
    Pull the next available pre-provisioned PG instance from the warm pool.
    WP minimum: 3×T1 + 2×T2 + 1×T3 [!]
    """
    # TODO: query WP registry (stored in a management table or Parameter Store)
    # Returns (pg_host, tier)
    raise NotImplementedError("Warm pool registry query not yet implemented")


def _provision_schema(tid: str, pg_host: str, schema: str):
    """Create schema and run Alembic migrations."""
    engine = get_tenant_engine(tid, pg_host, schema)
    with engine.connect() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        conn.commit()

    # Run Alembic migrations
    migrations_dir = os.path.join(os.path.dirname(__file__), "..", "migrations")
    result = subprocess.run(
        ["alembic", "-c", os.path.join(migrations_dir, "alembic.ini"), "upgrade", "head"],
        env={**os.environ, "TENANT_SCHEMA": schema, "TENANT_PG_HOST": pg_host},
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Alembic migration failed: {result.stderr}")


def _create_r2_folders(s3, tid: str):
    """Create placeholder objects to establish ECDN + CCDN folder structure."""
    for bucket, prefix in [
        (cfg.ECDN_BUCKET, f"events/{tid}/.keep"),
        (cfg.CCDN_BUCKET, f"weakness/{tid}/.keep"),
        (cfg.CCDN_BUCKET, f"bundles/{tid}/.keep"),
    ]:
        s3.put_object(Bucket=bucket, Key=prefix, Body=b"")


def _register_kv_routing(tid: str, routing: dict, s3):
    """
    Write routing info to a bootstrap R2 file.
    CF Worker's KV update is done via Wrangler or CF API call.
    TODO: call CF API to update KV directly.
    """
    key = f"routing/{tid}.json"
    s3.put_object(
        Bucket=cfg.CCDN_BUCKET,
        Key=key,
        Body=json.dumps(routing),
        ContentType="application/json",
    )


def _store_enc_secret(tid: str, enc_secret: str, secrets_client):
    """Store enc_secret in AWS Secrets Manager."""
    secrets_client.create_secret(
        Name=f"mock-test/tenant-enc-secret/{tid}",
        SecretString=json.dumps({"enc_secret": enc_secret}),
    )


def _write_enc_secret_to_db(tid: str, pg_host: str, schema: str, enc_secret: str):
    """enc_secret also stored in tenant PG users table — embedded in JWT [!]"""
    # Written when the first user is created; stored here for reference
    pass


def _trigger_initial_bundle(tid: str, strategy: str, config: dict):
    """Kick off BS for initial bundle deployment."""
    lambda_client = boto3.client("lambda")
    lambda_client.invoke(
        FunctionName=f"mock-test-bs-{cfg.ENV}",
        InvocationType="Event",
        Payload=json.dumps({"tid": tid, "bundle_strategy": strategy, "config": config}),
    )
