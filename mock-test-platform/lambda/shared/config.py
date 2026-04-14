"""
Shared configuration — reads from environment variables set by SAM template.
All Lambda→RDS connections via RDS Proxy only; never direct [!]
"""

import os


class Config:
    # RDS Proxy endpoints (set via SAM template from Secrets Manager)
    GLOBAL_RP_HOST: str = os.environ["GLOBAL_RP_HOST"]
    TENANT_RP_HOST_A: str = os.environ["TENANT_RP_HOST_A"]   # ap-south-1
    TENANT_RP_HOST_B: str = os.environ["TENANT_RP_HOST_B"]   # ap-southeast-1
    DB_PORT: int = int(os.environ.get("DB_PORT", "5432"))
    DB_NAME: str = os.environ.get("DB_NAME", "mocktest")

    # S3/R2 (accessed via boto3 with CF R2 S3-compatible API)
    ECDN_BUCKET: str = os.environ["ECDN_BUCKET"]
    CCDN_BUCKET: str = os.environ["CCDN_BUCKET"]

    # Region
    REGION_A: str = "ap-south-1"
    REGION_B: str = "ap-southeast-1"

    ENV: str = os.environ.get("ENV", "dev")

    # EPS chunking
    EPS_CHUNK_SIZE: int = 100

    # Warm pool minimum counts
    WP_MIN_T1: int = 3
    WP_MIN_T2: int = 2
    WP_MIN_T3: int = 1

    # TGM thresholds (5/7 rolling window)
    TGM_ROLLING_DAYS: int = 7
    TGM_TRIGGER_DAYS: int = 5
    T1_USER_LIMIT: int = 100_000   # 1L
    T2_USER_LIMIT: int = 250_000   # 2.5L
    T1_MAX_TENANTS: int = 10
    T2_MAX_TENANTS: int = 5
    T3_MAX_TENANTS: int = 3
    WRITE_LATENCY_THRESHOLD_MS: int = 300
    PEAK_CONN_WAIT_THRESHOLD_MS: int = 100

    # Diverging tenant: 3× group avg for 5/7 days → extraction
    DIVERGENCE_MULTIPLIER: float = 3.0


cfg = Config()
