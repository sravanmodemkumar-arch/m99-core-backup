# Observability

## Alert Thresholds

| Area | Alert Threshold |
|---|---|
| ECDN lag | P2 > 2h = incident; P7 > 3wk = incident |
| DO buffer | Not flushed within 2× expected; failure_count > 0 = immediate |
| DB + RDS Proxy | write_latency > 500ms; connections → limit; any tenant 3× above 30-day baseline |
| Global DB | query_latency > 200ms; connection_wait > 50ms |
| Lambda | invocation > 12min; same tenant timeout > 2×/day; DW overhead > 48h |
| CCDN staleness | gap > 10min vs last confirmed PG write |
| Bundle | download_fail > 2%/1h; swap stuck > 24h |
| Sync queue | retry_count > 2; age > 1 day; auth_blocked spike |
| Warm Pool | below minimum = critical |
| Cost anomaly | any metric > 2× 30-day avg |

## Alert Tiers

| Tier | Response Time |
|---|---|
| Critical | Immediate |
| Warning | Same-day |
| Info | Weekly |

## Tooling

| Tool | Purpose |
|---|---|
| CF Logpush → Analytics Engine | Edge metrics (Workers, DO, KV, R2) |
| Grafana (self-hosted) | Dashboards + alerting |
| CloudWatch | Lambda + RDS metrics |
| Total monitoring budget | < Rs2k/month |

## Modules (L33 · Observability)

```
240. Edge Metrics       → CF Workers, DO, KV, R2 metrics
241. Lambda Metrics     → invocation count, duration, errors, timeouts
242. DB Metrics         → write_latency, connection_wait, query_latency
243. Cost Monitor       → anomaly detection vs 30-day avg
244. Alert Engine       → critical/warning/info tier routing
245. Audit Log          → immutable record of all admin actions
```
