/**
 * EIS — Event Ingestion Service
 *
 * POST /v1/events
 *
 * Flow: Validate → compute pA → assign P0-P7 → DO → R2
 * DO writes immediately to R2 on arrival (crash = zero loss) [!]
 * All writes via DO only; never directly to R2 [!]
 *
 * pA = absolute UTC epoch; no timezone logic [!]
 * dynamic_delay = base_delay × tier_factor × (1/attemptNo) × score_factor
 */

import { requireAuth } from "../lib/jwt.js";
import { jsonResponse, errorResponse } from "../lib/kv.js";

// Base delays in seconds per priority
const BASE_DELAYS = {
  P0: 5,
  P1: 5 * 60,
  P2: 10 * 60,
  P3: 30 * 60,
  P4: 60 * 60,
  P5: 3 * 60 * 60,
  P6: 6 * 60 * 60,
  P7: 7 * 24 * 60 * 60,
};

export async function handleEvents(request, env, ctx) {
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  let payload;
  try {
    payload = await requireAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, "Unauthorized", 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_body", "Expected JSON", 400);
  }

  const { event_type, data } = body;
  if (!event_type || !data) {
    return errorResponse("missing_fields", "event_type and data required", 400);
  }

  // Assign priority based on event type
  const priority = assignPriority(event_type);

  // Compute pA (absolute UTC epoch) [!]
  const pA = computePA(priority, data, payload);

  const event = {
    uid: payload.uid,
    tid: payload.tid,
    gid: payload.gid,
    event_type,
    priority,
    pA,
    timestamp: Math.floor(Date.now() / 1000),
    data,
  };

  // Route to DO (1 per tenant group — serialized writer)
  const doId = env.BATCH_DO.idFromName(payload.gid);
  const stub = env.BATCH_DO.get(doId);
  await stub.fetch("https://do/write", {
    method: "POST",
    body: JSON.stringify(event),
  });

  return jsonResponse({ accepted: true, priority, pA });
}

function assignPriority(eventType) {
  const map = {
    subscription: "P0",
    settings_update: "P1",
    result_first_attempt: "P2",
    result_repeat: "P3",
    bundle_feedback: "P7",
    passive_analytics: "P7",
  };
  return map[eventType] ?? "P4";
}

function computePA(priority, data, jwtPayload) {
  const baseDelay = BASE_DELAYS[priority] ?? BASE_DELAYS["P4"];
  const tierFactor = data.subscription_tier === "premium" ? 0.5 : 1.0;
  const attemptNo = data.attempt_no ?? 1;
  const scoreFactor = (data.score ?? 0) > 90 ? 0.5 : 1.0;

  const dynamicDelay = baseDelay * tierFactor * (1 / attemptNo) * scoreFactor;
  const nowEpoch = Math.floor(Date.now() / 1000);
  return nowEpoch + Math.floor(dynamicDelay); // absolute UTC epoch [!]
}
