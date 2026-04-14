/**
 * TSF Builder — Test Session File
 * Builds the single JSON that drives the entire exam session.
 *
 * TSF is the contract between server and client.
 * Online  mode: questions[].content = null  (loaded from R2 on question open)
 * Offline mode: questions[].content = {...} (embedded, pre-downloaded in bundle)
 */

import { EXAM_PATTERN, MODULE_ID, MODULE_VERSION, TSF_VERSION, Q_STATE, TEST_STATUS } from './config.js'

/**
 * Build a fresh Test Session File
 * @param {object} opts
 * @param {string} opts.test_id       - unique test instance ID
 * @param {string} opts.year          - exam year e.g. "2024"
 * @param {string} opts.tenant_id     - tenant identifier
 * @param {object} opts.candidate     - { uid, name, roll_no, photo_url }
 * @param {Array}  opts.question_ids  - ordered array of 100 QIDs from DB
 * @param {boolean} opts.is_mock      - true for mock tests
 * @param {boolean} opts.canary       - true if served by canary version
 * @param {string}  opts.cen          - exam notification number e.g. "CEN-RRC-01/2024"
 * @returns {object} TSF — complete test session file
 */
export function buildTSF({
  test_id,
  year = new Date().getFullYear().toString(),
  tenant_id,
  candidate,
  question_ids,
  is_mock = true,
  canary  = false,
  cen     = 'CEN-RRC-01/2024',
}) {
  if (question_ids.length !== EXAM_PATTERN.totals.q_count) {
    throw new Error(`Expected ${EXAM_PATTERN.totals.q_count} questions, got ${question_ids.length}`)
  }

  const now = new Date().toISOString()

  // Build questions array — one entry per question slot
  const questions = question_ids.map((qid, idx) => {
    const qno     = idx + 1
    const section = EXAM_PATTERN.sections.find(s => qno >= s.q_from && qno <= s.q_to)

    return {
      qno,
      sid     : section.sid,
      qid,
      type    : 'S',            // mcq_single — all RRB Group D questions
      marks   : EXAM_PATTERN.marking.default.correct,
      neg     : EXAM_PATTERN.marking.default.wrong,
      langs   : ['en', 'hi'],
      yt      : false,
      offline : false,
      content : null,           // null = load from R2 on question open
    }
  })

  // Compute question hash for integrity
  const q_hash = computeHash(question_ids)

  return {
    // ── Identity ─────────────────────────────────────────────────────────
    tsf_version : TSF_VERSION,
    test_id,
    exam_id     : `RRB-GROUP-D-${year}`,
    pattern_id  : EXAM_PATTERN.pattern_id,
    tenant_id,

    // ── Header (what shows in UI top bar) ────────────────────────────────
    header: {
      board     : EXAM_PATTERN.header.board,
      cen,
      exam_name : EXAM_PATTERN.header.exam_name,
      post_name : EXAM_PATTERN.header.post_name,
    },

    // ── Candidate ────────────────────────────────────────────────────────
    candidate: {
      uid      : candidate.uid,
      name     : candidate.name,
      roll_no  : candidate.roll_no,
      photo_url: candidate.photo_url || null,
    },

    // ── Schedule ─────────────────────────────────────────────────────────
    schedule: {
      duration_sec : EXAM_PATTERN.schedule.duration_sec,
      grace_sec    : EXAM_PATTERN.schedule.grace_sec,
      start_at     : null,   // set when candidate clicks "Start Test"
      end_at       : null,   // computed: start_at + duration_sec
    },

    // ── Runtime Config ───────────────────────────────────────────────────
    config: { ...EXAM_PATTERN.config },

    // ── Marking Defaults ─────────────────────────────────────────────────
    marking: { ...EXAM_PATTERN.marking },

    // ── Sections ─────────────────────────────────────────────────────────
    sections: EXAM_PATTERN.sections.map(s => ({ ...s })),

    // ── Questions ────────────────────────────────────────────────────────
    questions,

    // ── State (initialized empty, filled during exam) ────────────────────
    state: {
      status          : TEST_STATUS.NOT_STARTED,
      started_at      : null,
      submitted_at    : null,
      time_elapsed_sec: 0,
      current_qno     : 1,
      current_sid     : EXAM_PATTERN.sections[0].sid,

      // answers: { "1": { v: ["B"], saved_at: "ISO" } }
      answers : {},

      // flags: { "1": "marked_review" | "answered_marked" }
      flags   : {},

      // visited: [1, 2, 5, ...] — question numbers opened
      visited : [],

      // local event buffer — flushed to EIS on connectivity
      events  : [],

      // tab_switches: count of tab/window switches
      tab_switches: 0,
    },

    // ── Integrity ────────────────────────────────────────────────────────
    integrity: {
      tsf_version    : TSF_VERSION,
      module_id      : MODULE_ID,
      module_version : MODULE_VERSION,
      shared_lib_ver : 'v1.0.0',
      generated_at   : now,
      generated_by   : 'tsf-builder',
      q_count        : EXAM_PATTERN.totals.q_count,
      q_hash,
      is_mock,
      canary,
      min_app_version: '1.0.0',
    },
  }
}

/**
 * Get question state from TSF state block
 * Maps to the 5 states in the real RRB CBT palette
 */
export function getQuestionState(state, qno) {
  const visited  = state.visited.includes(qno)
  const answered = !!state.answers[qno]
  const flagged  = !!state.flags[qno]

  if (!visited)             return 'not_visited'
  if (answered && flagged)  return 'answered_marked'
  if (answered)             return 'answered'
  if (flagged)              return 'marked_review'
  return 'not_answered'
}

/**
 * Start the test — sets start_at, end_at, status
 */
export function startTest(tsf) {
  const now    = new Date()
  const end_at = new Date(now.getTime() + (tsf.schedule.duration_sec * 1000))

  return {
    ...tsf,
    schedule: {
      ...tsf.schedule,
      start_at: now.toISOString(),
      end_at  : end_at.toISOString(),
    },
    state: {
      ...tsf.state,
      status    : 'in_progress',
      started_at: now.toISOString(),
      visited   : [1],           // Q1 auto-opened on start
      current_qno: 1,
    },
  }
}

/**
 * Save an answer to a question
 */
export function saveAnswer(tsf, qno, selected_options) {
  return {
    ...tsf,
    state: {
      ...tsf.state,
      answers: {
        ...tsf.state.answers,
        [qno]: { v: selected_options, saved_at: new Date().toISOString() },
      },
      visited: tsf.state.visited.includes(qno)
        ? tsf.state.visited
        : [...tsf.state.visited, qno],
    },
  }
}

/**
 * Clear an answer
 */
export function clearAnswer(tsf, qno) {
  const answers = { ...tsf.state.answers }
  delete answers[qno]
  return { ...tsf, state: { ...tsf.state, answers } }
}

/**
 * Toggle mark-for-review flag
 */
export function toggleFlag(tsf, qno) {
  const flags = { ...tsf.state.flags }
  if (flags[qno]) {
    delete flags[qno]
  } else {
    flags[qno] = true
  }
  return { ...tsf, state: { ...tsf.state, flags } }
}

/**
 * Simple hash of question IDs for integrity check
 */
function computeHash(qids) {
  // In production: SHA-256 via Web Crypto API
  // Placeholder for now
  const str = qids.join(',')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `simple:${Math.abs(hash).toString(16)}`
}
