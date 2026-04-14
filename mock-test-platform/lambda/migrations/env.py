"""
Alembic env.py — runs inside TPS/TMS Lambda.
Schema is set per-tenant via TENANT_SCHEMA env var.
All connections via RDS Proxy [!]
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make shared models importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.models import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Tenant schema from environment (set by TPS/TMS Lambda)
TENANT_SCHEMA = os.environ.get("TENANT_SCHEMA", "public")
TENANT_PG_HOST = os.environ.get("TENANT_PG_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "mocktest")
DB_USER = os.environ.get("DB_USER", "mocktest")
DB_PASS = os.environ.get("DB_PASS", "")


def get_url():
    return (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASS}"
        f"@{TENANT_PG_HOST}:{DB_PORT}/{DB_NAME}"
        f"?options=-csearch_path%3D{TENANT_SCHEMA}"
    )


def run_migrations_offline():
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        version_table_schema=TENANT_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    cfg = config.get_section(config.config_ini_section)
    cfg["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table_schema=TENANT_SCHEMA,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
