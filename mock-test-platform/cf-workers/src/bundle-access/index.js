/**
 * BAS — Bundle Access Service
 *
 * GET  /v1/bundle       → validate JWT + enrollment, return signed R2 URL
 * POST /v1/bundle/swap  → queue bundle swap (deferred until session ends) [!]
 *
 * BAS validates enrollment before serving any bundle URL [!]
 * Bundle swap never interrupts active test session [!]
 */

import { requireAuth } from "../lib/jwt.js";
import { jsonResponse, errorResponse } from "../lib/kv.js";

// Signed URL TTL in seconds (1 hour)
const SIGNED_URL_TTL = 3600;

export async function handleBundleAccess(request, env, ctx) {
  let payload;
  try {
    payload = await requireAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, "Unauthorized", 401);
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/v1/bundle") {
    return getBundle(request, payload, env);
  }
  if (request.method === "POST" && url.pathname === "/v1/bundle/swap") {
    return swapBundle(request, payload, env);
  }

  return errorResponse("not_found", "Unknown bundle endpoint", 404);
}

async function getBundle(request, payload, env) {
  const url = new URL(request.url);
  const examOrSubjectId = url.searchParams.get("id");
  const bundleType = url.searchParams.get("type"); // "exam" or "subject"

  if (!examOrSubjectId || !bundleType) {
    return errorResponse("missing_params", "id and type are required", 400);
  }

  // Validate enrollment before serving bundle URL [!]
  const enrolled = await checkEnrollment(payload.uid, payload.tid, examOrSubjectId, env);
  if (!enrolled) {
    return errorResponse("not_enrolled", "User is not enrolled for this exam/subject", 403);
  }

  // Generate signed R2 URL (time-limited)
  const bundlePath = `bundles/${bundleType}/${examOrSubjectId}/bundle.zip`;
  const signedUrl = await generateSignedUrl(bundlePath, env);

  return jsonResponse({
    url: signedUrl,
    expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL,
    bundle_type: bundleType,
    id: examOrSubjectId,
  });
}

async function swapBundle(request, payload, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_body", "Expected JSON", 400);
  }

  const { exam_or_subject_id, bundle_type, session_active } = body;

  // Bundle swap deferred until session ends [!]
  if (session_active) {
    return jsonResponse({
      queued: true,
      message: "Bundle swap queued — will apply after current test session ends",
    });
  }

  // Validate enrollment for new bundle
  const enrolled = await checkEnrollment(payload.uid, payload.tid, exam_or_subject_id, env);
  if (!enrolled) {
    return errorResponse("not_enrolled", "User is not enrolled for this exam/subject", 403);
  }

  // TODO: perform swap — update client's active bundle reference
  return jsonResponse({ swapped: true });
}

async function checkEnrollment(uid, tid, examOrSubjectId, env) {
  // TODO: query tenant PG student_enrollment table
  // Returns true if uid has active enrollment for examOrSubjectId
  return false;
}

async function generateSignedUrl(path, env) {
  // TODO: generate CF R2 signed URL using env.CCDN + signing key
  // R2 signed URLs have configurable TTL
  return `https://ccdn.example.com/${path}?token=PLACEHOLDER&expires=${Date.now() + SIGNED_URL_TTL * 1000}`;
}
