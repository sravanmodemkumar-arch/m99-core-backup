# Project Overview — Mock Test Platform

## Goal

Ultra-low-cost, offline-first mock test platform for India.

- 2000 tenants × 80k–1L users = **16–20 Cr total users**
- Cost target: **Rs 0.1–2/user/year**
- Two AWS regions: ap-south-1 (A) + ap-southeast-1 (B), 1000 tenants/region

## What it is

- Exam + subject bundle delivery (offline-first, AES-GCM encrypted)
- Global question bank shared across all tenants and exams
- Group-based dynamic PostgreSQL allocation (T1/T2/T3) via RDS Proxy
- Multi-user aggregated event batching (P0–P7)
- Per-attempt immutable result tracking
- Subject → topic → subtopic weakness analysis
- Full observability, log clearing, chunk-checkpoint Lambda

## Source Files (in /home/sravan/Desktop/projects/)

| File | Purpose |
|---|---|
| `00-master-layer-registry.md` | All 33 layers + 245 modules |
| `mock-test-platform-spec-v3-compact.md` | Full platform spec |
| `question-schema-v1.md` | QID format + DB record + R2 content/solution schema |

## Scale vs Cost

| Users/tenant | CF Workers | Lambda | RDS+RP | R2 | Total/mo | Rs/user/yr |
|---|---|---|---|---|---|---|
| 10k | Rs12 | Rs5 | Rs1,050 | Rs5 | Rs1,072 | Rs1.29 |
| 20k | Rs24 | Rs10 | Rs1,050 | Rs10 | Rs1,094 | Rs0.66 |
| 30k | Rs36 | Rs15 | Rs1,050 | Rs15 | Rs1,116 | Rs0.45 |
| 40k | Rs48 | Rs20 | Rs1,550 | Rs20 | Rs1,638 | Rs0.49 |

> RDS Proxy adds ~Rs50/instance/month; eliminates connection exhaustion at Lambda scale.
