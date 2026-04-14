"""
TGM — Tenant Growth Monitor

Trigger: Daily at 2AM IST (20:30 UTC)
Composite trigger: 2 of 3 conditions over 5/7 rolling days → promote/demote/extract [!]

Conditions:
  1. user_count crosses tier threshold
  2. avg_write_latency > 300ms
  3. peak_connection_wait > 100ms

Diverging tenant: 3× above group avg for 5/7 days → extraction via TMS

Demotion: 1st of month only; below lower threshold for 30 consecutive days
"""

import json
import time
import boto3
from datetime import datetime, timezone
from collections import defaultdict

from shared.config import cfg


def lambda_handler(event, context):
    lambda_client = boto3.client("lambda")
    cloudwatch = boto3.client("cloudwatch")

    tenants = _load_all_tenant_metrics()   # TODO: load from monitoring store
    actions = []

    for tenant in tenants:
        action = _evaluate_tenant(tenant, cloudwatch)
        if action:
            actions.append(action)
            _trigger_tms(lambda_client, tenant["tid"], action)

    return {"evaluated": len(tenants), "actions": actions}


def _evaluate_tenant(tenant: dict, cloudwatch) -> dict | None:
    tid = tenant["tid"]
    current_tier = tenant["tier"]
    group_id = tenant["group_id"]

    metrics = _fetch_rolling_metrics(tid, cloudwatch)

    # Check composite trigger — 2 of 3 [!]
    triggers_met = sum([
        metrics["user_count_breach"],
        metrics["write_latency_breach"],
        metrics["conn_wait_breach"],
    ])

    # Check divergence (3× group avg for 5/7 days)
    if metrics["diverging"]:
        return {"tid": tid, "action": "extract", "reason": "diverging_tenant"}

    if triggers_met >= 2:
        # Promotion: 5/7 rolling window [!]
        if metrics["breach_days"] >= cfg.TGM_TRIGGER_DAYS:
            target_tier = _next_tier(current_tier)
            if target_tier:
                return {"tid": tid, "action": "promote", "from": current_tier, "to": target_tier}

    # Demotion: 1st of month only; 30 consecutive days below threshold
    today = datetime.now(timezone.utc)
    if today.day == 1 and metrics["below_threshold_days"] >= 30:
        target_tier = _prev_tier(current_tier)
        if target_tier:
            return {"tid": tid, "action": "demote", "from": current_tier, "to": target_tier}

    return None


def _fetch_rolling_metrics(tid: str, cloudwatch) -> dict:
    """
    Fetch last 7 days of metrics for tenant.
    Returns breach counts and divergence flag.
    """
    # TODO: query CloudWatch or internal metrics store
    # Placeholder structure
    return {
        "user_count_breach": False,      # user_count > tier threshold in last 7d
        "write_latency_breach": False,   # avg_write_latency > 300ms in last 7d
        "conn_wait_breach": False,       # peak_conn_wait > 100ms in last 7d
        "breach_days": 0,                # days where 2+ conditions were true (max 7)
        "below_threshold_days": 0,       # consecutive days below lower threshold
        "diverging": False,              # 3× group avg for 5/7 days
    }


def _load_all_tenant_metrics() -> list[dict]:
    """Load tenant list with current tier + group from management store."""
    # TODO: load from management DB or Parameter Store
    return []


def _next_tier(tier: str) -> str | None:
    return {"T1": "T2", "T2": "T3"}.get(tier)


def _prev_tier(tier: str) -> str | None:
    return {"T3": "T2", "T2": "T1"}.get(tier)


def _trigger_tms(lambda_client, tid: str, action: dict):
    lambda_client.invoke(
        FunctionName=f"mock-test-tms-{cfg.ENV}",
        InvocationType="Event",
        Payload=json.dumps({"tid": tid, **action}),
    )
