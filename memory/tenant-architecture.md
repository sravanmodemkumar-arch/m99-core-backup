---
name: Tenant Architecture
description: 3-level tenant config hierarchy, PLATFORM_NAME env, tenant naming, module per tenant
type: project
---

## Naming Strategy

```
Git repo name    : mock-test-platform       ← permanent, never changes
PLATFORM_NAME    : mock99 (temp)            ← env var, changes brand everywhere
Tenant name      : per tenant in KV         ← overrides PLATFORM_NAME in UI
```

Changing `PLATFORM_NAME` changes: UI header, email templates, PDF reports,
API responses, error messages, mobile app name (app.json). Never hardcoded in code.

## 3-Level Config Hierarchy

Reads top to bottom. Highest level wins on conflict.

```
Level 1 — Platform defaults (env vars, set once)
  PLATFORM_NAME=mock99
  DEFAULT_LANG=hi
  DEFAULT_NEG_MARKS=0.33
  MAX_ATTEMPTS=3
  SUPPORT_EMAIL=help@mock99.com

Level 2 — Tenant Group (shared config for similar tenants)
  group:coaching  → { theme: blue,  modules: [rrb, ssc, banking] }
  group:school    → { theme: green, modules: [cbse, icse, ntse]  }
  group:state-ts  → { theme: red,   modules: [tspsc, tspolice]   }
  group:state-ap  → { theme: orange, modules: [appsc, appolice]  }

Level 3 — Individual Tenant (highest priority, overrides all)
  tenant:allen → { name: "ALLEN Mock Tests", primary_color: "#FF6B35" }
  tenant:sc    → { name: "Sri Chaitanya",    primary_color: "#003366" }
```

## Module Runtime Config Resolution

```javascript
function getTenantConfig(tenant_id) {
  const platform = env.PLATFORM_NAME                      // Level 1
  const group    = kv.get(`group:${tenant.group_id}`)    // Level 2
  const tenant   = kv.get(`tenant:${tenant_id}`)         // Level 3
  return merge(platform, group, tenant)                   // Level 3 wins
}
```

## Single Module Per Tenant

Each module serves one tenant's context at runtime — not one deployment per tenant.

- T1 tenants (small)   → shared module deployment, tenant config from KV
- T2 tenants (medium)  → dedicated CF Workers, tenant-specific env vars
- T3 tenants (large)   → fully isolated deployment, PLATFORM_NAME=<their brand>

Module reads `tenant_id` from JWT → looks up KV → applies name/theme.

## Onboarding New Tenant

```
1. Assign to group (e.g., group:coaching)   ← inherits all group defaults
2. Set tenant config — only custom fields:
   tenant:newclient = {
     name: "Vision IAS",
     primary_color: "#8B0000"
   }
Done. Everything else inherited. No need to configure 50 fields.
```

## Tenant Config Controls

| Config field | Level | Example |
|---|---|---|
| Negative marking default | 1 Platform | -0.33 |
| Max attempts per exam | 1 Platform | 3 |
| Modules enabled | 2 Group | [rrb, ssc, banking] |
| Theme color family | 2 Group | blue |
| Tenant brand name | 3 Tenant | "ALLEN Mock Tests" |
| Custom logo URL | 3 Tenant | cdn/allen/logo.png |
| Custom domain | 3 Tenant | allen.mock99.com |
| Per-exam time extension | 3 Tenant | +10 min for PwD |

## RBAC — Role System

Roles within each tenant:

```
Super Admin      → manages all tenants (platform level)
Tenant Admin     → manages their tenant only
Content Manager  → creates/edits questions only
Exam Manager     → creates exams, assigns questions
Evaluator        → grades descriptive answers
Student          → takes exams only
Parent           → views student reports only (read-only)
```

Content Manager cannot see student data.
Student cannot access question bank.
All roles enforced via entitlements module in shared-lib.

## Entitlements System

```javascript
entitlement.canAccess(tenant_id, module_id, feature)
// Pricing model changes = update entitlement rules only
// Module code never changes for pricing changes
```
