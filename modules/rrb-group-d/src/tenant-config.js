/**
 * Tenant Config Resolution — 3-Level Hierarchy
 * Level 1: Platform defaults (env vars)
 * Level 2: Tenant group config (KV)
 * Level 3: Individual tenant config (KV) — highest priority
 */

/**
 * Resolve final tenant config from all 3 levels
 * @param {object} env     - CF Worker env (has TENANT_KV binding + PLATFORM_NAME)
 * @param {string} tenant_id
 * @returns {object} merged config
 */
export async function resolveTenantConfig(env, tenant_id) {
  // Level 1 — platform defaults from env
  const platform = {
    name          : env.PLATFORM_NAME ?? 'm99-core',
    default_lang  : 'hi',
    neg_marks     : 0.33,
    max_attempts  : 3,
    support_email : `help@${env.PLATFORM_NAME ?? 'm99-core'}.com`,
    watermark_text: 'Mock Question',
    logo_url      : '/assets/default-logo.png',
  }

  let group  = {}
  let tenant = {}

  try {
    // Level 2 — tenant group config from KV
    const tenantMeta = await env.TENANT_KV.get(`tenant:${tenant_id}:meta`, { type: 'json' })
    if (tenantMeta?.group_id) {
      const groupConfig = await env.TENANT_KV.get(`group:${tenantMeta.group_id}`, { type: 'json' })
      group = groupConfig ?? {}
    }

    // Level 3 — individual tenant config from KV
    const tenantConfig = await env.TENANT_KV.get(`tenant:${tenant_id}:config`, { type: 'json' })
    tenant = tenantConfig ?? {}
  } catch (err) {
    // KV unavailable — fallback to platform defaults gracefully
    console.error(`[tenant-config] KV error for ${tenant_id}:`, err.message)
  }

  // Merge: Level 3 wins over Level 2 wins over Level 1
  return deepMerge(platform, group, tenant)
}

/**
 * Check if tenant has access to this module
 */
export async function checkModuleAccess(env, tenant_id, module_id) {
  try {
    const config = await env.TENANT_KV.get(`tenant:${tenant_id}:config`, { type: 'json' })
    const enabled = config?.modules_enabled

    // If no restriction set — allow all (default open)
    if (!enabled) return { allowed: true }

    if (!enabled.includes(module_id)) {
      return { allowed: false, reason: `Module ${module_id} not enabled for tenant ${tenant_id}` }
    }

    return { allowed: true }
  } catch {
    return { allowed: true } // fail open — don't block exam on KV error
  }
}

/**
 * Get module version from registry (supports canary routing)
 * @param {object} env
 * @param {string} uid - student UID (used for deterministic canary routing)
 */
export async function resolveModuleVersion(env, uid) {
  try {
    const registry = await env.MODULE_REGISTRY.get('rrb-group-d', { type: 'json' })
    if (!registry) return { version: 'v1.0.0', canary: false }

    const { stable, canary, canary_pct = 0, canary_tenants = [] } = registry

    // Deterministic routing: same user always gets same version
    const hash = simpleHash(uid) % 100
    const useCanary = hash < canary_pct

    return {
      version: useCanary ? canary : stable,
      canary : useCanary,
    }
  } catch {
    return { version: 'v1.0.0', canary: false }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepMerge(...objects) {
  return objects.reduce((acc, obj) => {
    if (!obj) return acc
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        acc[key] = deepMerge(acc[key] ?? {}, val)
      } else if (val !== undefined && val !== null) {
        acc[key] = val
      }
    }
    return acc
  }, {})
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
