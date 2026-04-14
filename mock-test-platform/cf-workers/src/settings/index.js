/**
 * SS — Settings Service
 *
 * GET   /v1/settings  → return current settings + remaining update count
 * PATCH /v1/settings  → apply update if count < limit; recalc pA on overwrite
 *
 * 3-update lifetime limit enforced server-side only in tenant PG [!]
 * Remaining count returned in every response [!]
 */

import { requireAuth } from "../lib/jwt.js";
import { jsonResponse, errorResponse } from "../lib/kv.js";

const SETTINGS_UPDATE_LIMIT = 3; // [!] enforced server-side, never client-side

export async function handleSettings(request, env, ctx) {
  let payload;
  try {
    payload = await requireAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, "Unauthorized", 401);
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/v1/settings") {
    return getSettings(payload, env);
  }
  if (request.method === "PATCH" && url.pathname === "/v1/settings") {
    return updateSettings(request, payload, env);
  }

  return errorResponse("not_found", "Unknown settings endpoint", 404);
}

async function getSettings(payload, env) {
  // TODO: fetch from tenant PG (via internal Lambda) — user_settings + settings_update_count
  const { uid, tid } = payload;
  const settings = await fetchSettings(uid, tid, env);
  return jsonResponse({
    settings: settings.fields,
    remaining_updates: SETTINGS_UPDATE_LIMIT - settings.update_count,
  });
}

async function updateSettings(request, payload, env) {
  const { uid, tid } = payload;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_body", "Expected JSON", 400);
  }

  // Fetch current count — enforced server-side [!]
  const current = await fetchSettings(uid, tid, env);
  if (current.update_count >= SETTINGS_UPDATE_LIMIT) {
    return errorResponse(
      "update_limit_reached",
      `Settings can only be updated ${SETTINGS_UPDATE_LIMIT} times`,
      403
    );
  }

  // TODO: write new settings to tenant PG
  // TODO: recalculate pA for any pending events affected by this settings change
  const newCount = current.update_count + 1;
  await writeSettings(uid, tid, body, newCount, env);

  return jsonResponse({
    updated: true,
    remaining_updates: SETTINGS_UPDATE_LIMIT - newCount,
  });
}

async function fetchSettings(uid, tid, env) {
  // TODO: query tenant PG users + user_settings tables
  return { fields: {}, update_count: 0 };
}

async function writeSettings(uid, tid, fields, newCount, env) {
  // TODO: write to user_settings + increment settings_update_count in users table
}
