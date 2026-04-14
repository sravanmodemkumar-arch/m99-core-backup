# Tech Stack

## Legend / Abbreviations

```
CF   = Cloudflare             DO   = Durable Object
KV   = CF Workers KV          R2   = CF R2
λ    = AWS Lambda             RDS  = AWS RDS PostgreSQL
PG   = PostgreSQL             PgB  = PgBouncer
GDB  = Global DB              TID  = tenantId
GID  = groupId                UID  = userId
QID  = questionId             pA   = processAfter
DW   = dual-write             WP   = warm pool
EIS  = Event Ingestion        EPS  = Event Processing
CGS  = Content Gen Svc        BS   = Bundle Svc
BAS  = Bundle Access Svc      AS   = Auth Svc
SS   = Settings Svc           TPS  = Tenant Provisioning Svc
TGM  = Tenant Growth Monitor  TMS  = Tenant Migration Svc
T1/T2/T3 = DB Tiers           WS   = weakness_snapshot
RC   = retention config       [!]  = non-negotiable
ECDN = Event CDN (R2)         CCDN = Content CDN (R2)
PS   = AWS Parameter Store
```

---

## Stack by Layer

| Layer | Tool | Open Source | Cost |
|---|---|---|---|
| Edge runtime | Cloudflare Workers (JS) | No | Free tier → $5/mo |
| Edge KV | CF Workers KV | No | Free tier |
| Edge storage | CF R2 | No | Free tier (10 GB) |
| Edge serialized write | CF Durable Objects | No | Free tier |
| Compute | AWS Lambda (Python 3.12) | No | Free tier (1M req/mo) |
| DB — production | AWS RDS PostgreSQL 16 | No | Paid |
| DB — dev / staging | Neon (serverless PG) | No | Free tier |
| Connection pooler | PgBouncer on ECS Fargate | Yes | ~$5–10/mo per tier |
| DB migrations | Alembic | Yes | Free |
| Secrets — runtime | AWS Parameter Store Standard | No | Free (≤10k params) |
| Secrets — dev team | Infisical (self-hosted) | Yes | Free |
| Mobile | React Native (Expo) | Yes | Free |
| Mobile storage | expo-sqlite (SQLite) | Yes | Free |
| Mobile encryption | react-native-quick-crypto (AES-GCM) | Yes | Free |
| Mobile sync | react-native-background-fetch | Yes | Free |
| Mobile build | EAS Build (free tier) / Fastlane | Mixed | Free |
| Web client | Browser + IndexedDB | — | Free |
| Web encryption | Web Crypto API (AES-GCM) | — | Free |
| Local CF dev | Miniflare | Yes | Free |
| Local S3/R2 dev | MinIO | Yes | Free |
| Local DB dev | PostgreSQL (Docker) | Yes | Free |
| Local pooler dev | PgBouncer (Docker) | Yes | Free |
| Monitoring | Grafana + Prometheus + Loki + Alertmanager | Yes | Free (self-hosted) |
| Log ingestion | CF Logpush → Loki | Mixed | Free |
| CI/CD | GitHub Actions | No | Free (2000 min/mo) |
| Deploy — CF | Wrangler | Yes | Free |
| Deploy — Lambda | AWS SAM | Yes | Free |
| Testing — JS | Vitest | Yes | Free |
| Testing — Python | Pytest | Yes | Free |

---

## Why PgBouncer over RDS Proxy

RDS Proxy costs ~$22/month per RDS instance (2 vCPU × $0.015/hr × 730h).
- 200 T1 instances → **$4,400/month** on proxies alone.

PgBouncer in **transaction mode** solves the same problem (Lambda cold start connection storms):
- 1 PgBouncer cluster per DB tier (T1, T2, T3)
- Runs on ECS Fargate containers → **~$15–30/month total**
- Open source, battle-tested, no vendor lock-in

```
Lambda → PgBouncer (ECS Fargate, 1 per tier) → RDS instance pool
```

---

## Why Parameter Store over Secrets Manager

Secrets Manager: $0.40/secret/month.
- 2000 tenants × 2 secrets = 4000 × $0.40 = **$1,600/month**

Parameter Store Standard: **free** up to 10,000 parameters.
- API calls: $0.05 per 10,000 → ~$0.60/month at our Lambda invocation rate
- Total: **~$0.60/month** vs $1,600/month

---

## Why Neon for Dev/Staging

- Free tier: 0.5 GB, unlimited branches
- Branch per feature branch → isolated DB for every PR
- Alembic works identically against Neon as against RDS
- Zero config, no server to manage

---

## Monitoring Stack (self-hosted, single EC2 t3.small ~$15/mo)

```
CF Logpush   ──→  Loki  ──→  Grafana dashboards
Lambda       ──→  Prometheus Pushgateway  ──→  Prometheus  ──→  Grafana
RDS metrics  ──→  Prometheus (postgres_exporter)
Alertmanager ──→  PagerDuty / Slack / Email (free tiers)
```

Replaces: CloudWatch (paid beyond free tier)

---

## CI/CD — GitHub Actions

```
.github/workflows/
  test.yml          → on PR: Vitest + Pytest (Neon branch DB)
  deploy-workers.yml → on merge to main: wrangler deploy
  deploy-lambda.yml  → on merge to main: sam deploy
  migrate.yml        → manual trigger: alembic upgrade head
```

---

## Local Development (Docker Compose)

```yaml
services:
  postgres:   official postgres:16 image
  pgbouncer:  edoburu/pgbouncer image
  minio:      minio/minio (S3/R2 compatible)
  infisical:  infisical/infisical (secrets UI)
  grafana:    grafana/grafana
  prometheus: prom/prometheus
  loki:       grafana/loki

# Miniflare runs outside Docker (npx miniflare)
# React Native runs via Expo Go on device
```

---

## Mobile (React Native)

| Concern | Library | Notes |
|---|---|---|
| Storage | expo-sqlite | SQLite, same schema as spec |
| Encryption | react-native-quick-crypto | AES-GCM 256-bit, Web Crypto compatible |
| Background sync | react-native-background-fetch | Sync between sessions only [!] |
| Bundle files | react-native-fs | Filesystem storage for offline bundles |
| Key-value | @react-native-async-storage/async-storage | App settings, JWT cache |
| Build | EAS Build (free: 30 builds/mo) or Fastlane | iOS + Android |
| Dev | Expo Go | Zero native build for dev |

Same AES-GCM logic, same sync queue, same offline rules as web [!]

---

## What Was Dropped and Why

| Dropped | Replaced by | Reason |
|---|---|---|
| Flutter | React Native only | One codebase, larger ecosystem, team familiarity |
| Tauri / Desktop | — (v2 later) | Web + mobile covers 95% of India exam prep use case |
| AWS RDS Proxy | PgBouncer (open source) | 99% cost reduction at 2000-tenant scale |
| AWS Secrets Manager | AWS Parameter Store | 99% cost reduction; free tier covers all tenants |
| AWS CloudWatch (heavy) | Prometheus + Loki + Grafana | Open source, self-hosted, zero variable cost |

---

## Infrastructure Summary

**CF layer (edge, zero cold start):**
Workers (AS, SS, EIS, BAS) | KV (tenant routing) | R2 (ECDN + CCDN; zero egress cost) | DO (1 serialized writer per group) | Logpush → Loki

**AWS layer (compute + DB):**
Lambda Python 3.12 (EPS, CGS, BS, TPS, TGM, TMS; 15-min max) |
RDS PG 16 — global schema (questions/exams/subjects) + tenant schemas (T1/T2/T3) |
PgBouncer on ECS Fargate (1 cluster per tier, replaces RDS Proxy) |
Parameter Store Standard (runtime secrets, free) |
ECS Fargate (PgBouncer + monitoring stack)

**Dev/Staging:**
Neon (free PG branches) | MinIO (local R2) | Miniflare (local Workers) | Infisical (team secrets)

**CI/CD:** GitHub Actions → Wrangler (CF) + AWS SAM (Lambda)
