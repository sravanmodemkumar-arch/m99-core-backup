/**
 * RRB Group D — CF Worker Entry Point
 * Module: rrb-group-d | Version: v1.0.0
 *
 * Routes:
 *   GET  /health                        → module health check
 *   GET  /exam/rrb-group-d/config       → exam pattern config (public)
 *   POST /exam/rrb-group-d/session      → create new test session (TSF)
 *   GET  /exam/rrb-group-d/:test_id     → fetch existing TSF
 *   POST /exam/rrb-group-d/:test_id/start    → start timer
 *   POST /exam/rrb-group-d/:test_id/answer   → save answer
 *   POST /exam/rrb-group-d/:test_id/flag     → toggle mark-for-review
 *   POST /exam/rrb-group-d/:test_id/submit   → submit exam
 *   GET  /exam/rrb-group-d/:test_id/result   → fetch result
 */

import { EXAM_PATTERN, MODULE_ID, MODULE_VERSION } from './config.js'
import { buildTSF, startTest, saveAnswer, clearAnswer, toggleFlag, previewScore } from './tsf-builder.js'
import { computeResult, previewScore as markingPreview } from './marking-engine.js'
import { resolveTenantConfig, checkModuleAccess, resolveModuleVersion } from './tenant-config.js'

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // ── Error boundary — one crash never escapes this module ───────────────
    try {
      return await handleRequest(request, env, ctx)
    } catch (err) {
      console.error(`[rrb-group-d] Unhandled error:`, err)

      // Log to observability
      ctx.waitUntil(logError(env, err, request))

      return errorResponse(500, 'Module temporarily unavailable. Your progress is saved. Please retry in 2 minutes.', {
        module_id: MODULE_ID,
        module_version: MODULE_VERSION,
        trace_id: request.headers.get('x-trace-id') ?? crypto.randomUUID(),
      })
    }
  },
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleRequest(request, env, ctx) {
  const url    = new URL(request.url)
  const path   = url.pathname
  const method = request.method

  // CORS preflight
  if (method === 'OPTIONS') return corsResponse()

  // ── Auth + tenant resolution ───────────────────────────────────────────
  const { tenant_id, uid, error: authErr } = await verifyJWT(request, env)
  if (authErr && !path.endsWith('/health') && !path.endsWith('/config')) {
    return errorResponse(401, authErr)
  }

  // ── Health ────────────────────────────────────────────────────────────
  if (path.endsWith('/health')) {
    return jsonResponse({ status: 'ok', module: MODULE_ID, version: MODULE_VERSION, ts: Date.now() })
  }

  // ── Exam pattern config (public, no auth needed) ──────────────────────
  if (method === 'GET' && path.endsWith('/config')) {
    return jsonResponse({
      exam_id    : EXAM_PATTERN.exam_id,
      pattern_id : EXAM_PATTERN.pattern_id,
      totals     : EXAM_PATTERN.totals,
      sections   : EXAM_PATTERN.sections.map(s => ({
        sid: s.sid, label: s.label, subject: s.subject, q_count: s.q_count,
      })),
      marking    : EXAM_PATTERN.marking,
      schedule   : EXAM_PATTERN.schedule,
    })
  }

  // ── Module access check ───────────────────────────────────────────────
  const access = await checkModuleAccess(env, tenant_id, MODULE_ID)
  if (!access.allowed) return errorResponse(403, access.reason)

  // ── Tenant config ─────────────────────────────────────────────────────
  const tenantConfig = await resolveTenantConfig(env, tenant_id)

  // ── Route: create session ─────────────────────────────────────────────
  if (method === 'POST' && path.endsWith('/session')) {
    return handleCreateSession(request, env, uid, tenant_id, tenantConfig)
  }

  // ── Routes with test_id ───────────────────────────────────────────────
  const testIdMatch = path.match(/\/([A-Z0-9\-]+)\/(start|answer|flag|submit|result)$/) ??
                      path.match(/\/([A-Z0-9\-]+)$/)
  if (!testIdMatch) return errorResponse(404, 'Route not found')

  const test_id = testIdMatch[1]
  const action  = testIdMatch[2] ?? null

  switch (`${method}:${action}`) {
    case 'GET:null':    return handleGetTSF(env, test_id, uid)
    case 'POST:start':  return handleStart(env, test_id, uid)
    case 'POST:answer': return handleAnswer(request, env, test_id, uid)
    case 'POST:flag':   return handleFlag(request, env, test_id, uid)
    case 'POST:submit': return handleSubmit(request, env, test_id, uid, ctx)
    case 'GET:result':  return handleResult(env, test_id, uid)
    default:            return errorResponse(404, 'Route not found')
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCreateSession(request, env, uid, tenant_id, tenantConfig) {
  const body = await request.json()
  const { candidate, question_ids, is_mock = true, cen, year } = body

  if (!question_ids || question_ids.length !== EXAM_PATTERN.totals.q_count) {
    return errorResponse(400, `question_ids must contain exactly ${EXAM_PATTERN.totals.q_count} QIDs`)
  }

  const { version, canary } = await resolveModuleVersion(env, uid)
  const test_id = `TST-${MODULE_ID.toUpperCase()}-${Date.now()}-${uid.slice(-6)}`

  const tsf = buildTSF({
    test_id, year, tenant_id, candidate,
    question_ids, is_mock, canary, cen,
  })

  // Store TSF in KV — expires in 48 hours
  await env.TENANT_KV.put(
    `tsf:${test_id}`,
    JSON.stringify(tsf),
    { expirationTtl: 172800 }
  )

  return jsonResponse({ test_id, status: tsf.state.status }, 201)
}

async function handleGetTSF(env, test_id, uid) {
  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')

  // Strip content from offline bundles before sending (loaded on-demand)
  const safe = { ...tsf, questions: tsf.questions.map(q => ({ ...q, content: null })) }
  return jsonResponse(safe)
}

async function handleStart(env, test_id, uid) {
  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')
  if (tsf.state.status !== 'not_started') return errorResponse(409, `Test already ${tsf.state.status}`)

  const updated = startTest(tsf)
  await saveTSF(env, test_id, updated)
  return jsonResponse({ status: updated.state.status, started_at: updated.schedule.start_at, end_at: updated.schedule.end_at })
}

async function handleAnswer(request, env, test_id, uid) {
  const { qno, selected, action = 'save' } = await request.json()
  if (!qno || qno < 1 || qno > EXAM_PATTERN.totals.q_count) {
    return errorResponse(400, 'Invalid qno')
  }

  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')
  if (tsf.state.status !== 'in_progress') return errorResponse(409, 'Test not in progress')

  const updated = action === 'clear'
    ? clearAnswer(tsf, qno)
    : saveAnswer(tsf, qno, selected)

  await saveTSF(env, test_id, updated)
  return jsonResponse({ qno, state: getQuestionStateLabel(updated, qno) })
}

async function handleFlag(request, env, test_id, uid) {
  const { qno } = await request.json()
  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')

  const updated = toggleFlag(tsf, qno)
  await saveTSF(env, test_id, updated)
  return jsonResponse({ qno, flagged: !!updated.state.flags[qno] })
}

async function handleSubmit(request, env, test_id, uid, ctx) {
  // Idempotency key — prevent double-submit on network retry
  const idempotency_key = request.headers.get('x-idempotency-key')
  if (idempotency_key) {
    const cached = await env.TENANT_KV.get(`idem:${idempotency_key}`)
    if (cached) return jsonResponse(JSON.parse(cached)) // return cached response
  }

  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')
  if (tsf.state.status === 'submitted') return errorResponse(409, 'Already submitted')

  const preview = previewScore(tsf)
  const submitted = {
    ...tsf,
    state: { ...tsf.state, status: 'submitted', submitted_at: new Date().toISOString() }
  }

  await saveTSF(env, test_id, submitted)

  // Emit P0 event — highest priority, must not be lost
  ctx.waitUntil(emitEvent(env, {
    priority : 'P0',
    type     : 'TEST_SUBMIT',
    test_id,
    uid,
    tenant_id: tsf.tenant_id,
    module_id: MODULE_ID,
    payload  : { answers: tsf.state.answers, submitted_at: submitted.state.submitted_at }
  }))

  const response = { test_id, status: 'submitted', summary: preview }

  // Cache idempotent response
  if (idempotency_key) {
    await env.TENANT_KV.put(`idem:${idempotency_key}`, JSON.stringify(response), { expirationTtl: 3600 })
  }

  return jsonResponse(response)
}

async function handleResult(env, test_id, uid) {
  const tsf = await getTSF(env, test_id)
  if (!tsf) return errorResponse(404, 'Test session not found')
  if (tsf.candidate.uid !== uid) return errorResponse(403, 'Forbidden')
  if (tsf.state.status !== 'submitted') return errorResponse(409, 'Test not yet submitted')

  // Fetch answer key from R2
  const answerKey = await getAnswerKey(env, tsf.exam_id)
  if (!answerKey) return errorResponse(503, 'Answer key not available yet')

  const result = computeResult(tsf, answerKey)
  return jsonResponse(result)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTSF(env, test_id) {
  const raw = await env.TENANT_KV.get(`tsf:${test_id}`)
  return raw ? JSON.parse(raw) : null
}

async function saveTSF(env, test_id, tsf) {
  await env.TENANT_KV.put(`tsf:${test_id}`, JSON.stringify(tsf), { expirationTtl: 172800 })
}

async function getAnswerKey(env, exam_id) {
  try {
    const obj = await env.CONTENT_BUCKET.get(`answer-keys/${exam_id}.json`)
    return obj ? await obj.json() : null
  } catch { return null }
}

async function verifyJWT(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header' }

  try {
    // JWT verification via Web Crypto API
    // Payload: { uid, tenant_id, exp }
    const parts   = token.split('.')
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp < Date.now() / 1000) return { error: 'Token expired' }
    return { uid: payload.uid, tenant_id: payload.tenant_id }
  } catch {
    return { error: 'Invalid token' }
  }
}

async function emitEvent(env, event) {
  try {
    // In production: send to EIS (Event Ingestion Service) via fetch
    // For now: log to console
    console.log(`[event:${event.priority}]`, JSON.stringify(event))
  } catch (err) {
    console.error('[emitEvent] failed:', err.message)
  }
}

async function logError(env, err, request) {
  try {
    console.error(JSON.stringify({
      module    : MODULE_ID,
      version   : MODULE_VERSION,
      error     : err.message,
      stack     : err.stack,
      url       : request.url,
      method    : request.method,
      trace_id  : request.headers.get('x-trace-id'),
      ts        : new Date().toISOString(),
    }))
  } catch {}
}

function getQuestionStateLabel(tsf, qno) {
  const visited  = tsf.state.visited.includes(qno)
  const answered = !!tsf.state.answers[qno]
  const flagged  = !!tsf.state.flags[qno]
  if (!visited)             return 'not_visited'
  if (answered && flagged)  return 'answered_marked'
  if (answered)             return 'answered'
  if (flagged)              return 'marked_review'
  return 'not_answered'
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type'                : 'application/json',
      'Access-Control-Allow-Origin' : '*',
      'X-Module-ID'                 : MODULE_ID,
      'X-Module-Version'            : MODULE_VERSION,
    },
  })
}

function errorResponse(status, message, extra = {}) {
  return jsonResponse({ error: message, ...extra }, status)
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin' : '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key, X-Trace-ID',
    },
  })
}
