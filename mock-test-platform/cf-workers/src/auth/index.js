/**
 * AS — Auth Service
 *
 * POST /v1/auth/login   → validates credentials, issues JWT
 * GET  /v1/auth/validate → validates existing JWT
 *
 * JWT embeds: uid, tid, gid, enc_secret
 * enc_secret is 32-byte hex stored in tenant PG, embedded in JWT, never rotated [!]
 */

import { signJWT, verifyJWT } from "../lib/jwt.js";
import { getTenantRoute, jsonResponse, errorResponse } from "../lib/kv.js";

export async function handleAuth(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/v1/auth/login") {
    return login(request, env);
  }
  if (request.method === "GET" && url.pathname === "/v1/auth/validate") {
    return validate(request, env);
  }

  return errorResponse("not_found", "Unknown auth endpoint", 404);
}

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_body", "Expected JSON", 400);
  }

  const { tid, username, password } = body;
  if (!tid || !username || !password) {
    return errorResponse("missing_fields", "tid, username, password required", 400);
  }

  // Resolve tenant routing from KV
  let route;
  try {
    route = await getTenantRoute(tid, env);
  } catch {
    return errorResponse("tenant_not_found", `Tenant ${tid} not found`, 404);
  }

  // TODO: validate credentials against tenant PG via Lambda/internal API
  // Lambda holds DB connections; CF Workers never connect to PG directly
  // For now: stub — replace with actual credential check
  const user = await validateCredentials(tid, username, password, route, env);
  if (!user) return errorResponse("invalid_credentials", "Invalid username or password", 401);

  const token = await signJWT(
    {
      uid: user.uid,
      tid,
      gid: route.group_id,
      enc_secret: user.enc_secret, // 32-byte hex [!]
    },
    env.JWT_SECRET,
    86400 // 24h
  );

  return jsonResponse({ token, uid: user.uid, tid, gid: route.group_id });
}

async function validate(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return errorResponse("missing_token", "Authorization header required", 401);

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return jsonResponse({ valid: true, uid: payload.uid, tid: payload.tid, gid: payload.gid });
  } catch (err) {
    return errorResponse(err.message, "Token invalid or expired", 401);
  }
}

async function validateCredentials(tid, username, password, route, env) {
  // TODO: call internal Lambda endpoint or use tenant PG credentials check
  // Return: { uid, enc_secret } or null
  return null;
}
