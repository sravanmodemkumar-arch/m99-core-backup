/**
 * KV routing utilities
 *
 * KV stores: tid -> { pg_host, schema, group_id, tier }
 * Routing: JWT.tid -> KV -> tenant PG via RDS Proxy
 * CF Workers never access global schema [!]
 */

export async function getTenantRoute(tid, env) {
  const cached = await env.TENANT_ROUTING.get(tid, { type: "json" });
  if (!cached) throw new Error(`tenant_not_found: ${tid}`);
  // { pg_host, schema, group_id, tier }
  return cached;
}

export async function setTenantRoute(tid, route, env) {
  // Called by TPS after provisioning a new tenant
  await env.TENANT_ROUTING.put(tid, JSON.stringify(route));
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(code, message, status = 400) {
  return jsonResponse({ error: code, message }, status);
}
