"""
DB connection utilities.

Rules:
- All Lambda→RDS connections via RDS Proxy only; never direct [!]
- Global DB: questions, exams, subjects (read-only for all services except TPS/TMS)
- Tenant DB: results, users, settings, enrollment, weakness_snapshot (isolated per tenant)
- CF Workers never access global schema [!]
- Tenant schema stores qid reference only; never question content [!]
"""

import boto3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from functools import lru_cache

from .config import cfg


def _get_db_password(secret_name: str) -> str:
    """Fetch DB password from AWS Secrets Manager."""
    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_name)
    import json
    secret = json.loads(response["SecretString"])
    return secret["password"]


@lru_cache(maxsize=1)
def get_global_engine():
    """
    Global DB engine — reads questions, exams, subjects.
    Connected via global RDS Proxy [!]
    BS reads here; CF Workers never touch this [!]
    """
    password = _get_db_password("mock-test/global-db-credentials")
    url = (
        f"postgresql+psycopg2://mocktest_global:{password}"
        f"@{cfg.GLOBAL_RP_HOST}:{cfg.DB_PORT}/{cfg.DB_NAME}"
    )
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)


@lru_cache(maxsize=200)
def get_tenant_engine(tid: str, pg_host: str, schema: str):
    """
    Tenant DB engine — isolated per tenant.
    Connected via tenant RDS Proxy (T1/T2/T3) [!]
    Stores qid reference only; never question content [!]
    """
    password = _get_db_password(f"mock-test/tenant-db-credentials/{tid}")
    url = (
        f"postgresql+psycopg2://mocktest_{tid}:{password}"
        f"@{pg_host}:{cfg.DB_PORT}/{cfg.DB_NAME}"
        f"?options=-csearch_path%3Dtid_{tid}"
    )
    return create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=5)


def global_session() -> Session:
    engine = get_global_engine()
    return sessionmaker(bind=engine)()


def tenant_session(tid: str, pg_host: str, schema: str) -> Session:
    engine = get_tenant_engine(tid, pg_host, schema)
    return sessionmaker(bind=engine)()
