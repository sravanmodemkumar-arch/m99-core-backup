/**
 * Marking Engine — RRB Group D
 * Score = Σ correct(+1) − Σ wrong(×1/3)
 * Unattempted = 0 (never penalized)
 *
 * Full floating-point precision preserved throughout.
 * No mid-calculation rounding — only the display layer rounds.
 * Competitive exam rank calculation requires exact values.
 *
 * Runs client-side at submit preview + server-side for final score.
 * Both must produce identical results — deterministic, no randomness.
 */

/**
 * Compute full exam result from TSF
 * @param {object} tsf - complete Test Session File
 * @param {object} answer_key - { qno: correct_options[] } e.g. { "1": ["B"], "2": ["A","C"] }
 * @returns {object} result
 */
export function computeResult(tsf, answer_key) {
  const marking    = tsf.marking.default
  const questions  = tsf.questions
  const answers    = tsf.state.answers

  let correct_count    = 0
  let wrong_count      = 0
  let unattempted_count = 0
  let score            = 0

  const per_question = {}

  for (const q of questions) {
    const qno       = q.qno
    const student   = answers[qno]?.v ?? []
    const correct   = answer_key[qno] ?? []

    // Per-question marking override > exam-level default
    const marks_correct = q.marks ?? marking.correct
    const marks_wrong   = q.neg   ?? marking.wrong

    let status, earned

    if (student.length === 0) {
      status = 'unattempted'
      earned = 0
      unattempted_count++
    } else if (arraysEqual(student.sort(), correct.sort())) {
      status = 'correct'
      earned = marks_correct
      correct_count++
      score += earned
    } else {
      status = 'wrong'
      earned = -marks_wrong
      wrong_count++
      score += earned
    }

    per_question[qno] = { status, earned, student, correct }
  }

  // No rounding — full precision for rank computation.
  // Display layer rounds for candidate view (e.g. toFixed(2)).

  return {
    score,
    correct_count,
    wrong_count,
    unattempted_count,
    total_q       : questions.length,
    max_marks     : tsf.marking.default.correct * questions.length,
    percentage    : (score / (tsf.marking.default.correct * questions.length)) * 100,
    per_section   : computeSectionScores(tsf, per_question),
    per_question,
    computed_at   : new Date().toISOString(),
    module_version: tsf.integrity.module_version,
  }
}

/**
 * Section-wise score breakdown
 */
function computeSectionScores(tsf, per_question) {
  return tsf.sections.map(section => {
    let s_score = 0, s_correct = 0, s_wrong = 0, s_unattempted = 0

    for (let qno = section.q_from; qno <= section.q_to; qno++) {
      const r = per_question[qno]
      if (!r) continue
      s_score += r.earned
      if (r.status === 'correct')     s_correct++
      if (r.status === 'wrong')       s_wrong++
      if (r.status === 'unattempted') s_unattempted++
    }

    return {
      sid          : section.sid,
      label        : section.label,
      subject      : section.subject,
      score        : s_score,   // full precision — no rounding
      correct      : s_correct,
      wrong        : s_wrong,
      unattempted  : s_unattempted,
      total_q      : section.q_count,
    }
  })
}

/**
 * Quick score preview — runs on client before submit confirmation
 * Shows: "You will score approximately X marks. Y questions unanswered."
 */
export function previewScore(tsf) {
  const answers = tsf.state.answers
  const total   = tsf.questions.length
  const answered = Object.keys(answers).length
  const unanswered = total - answered

  return {
    answered,
    unanswered,
    flagged: Object.keys(tsf.state.flags).length,
    message: unanswered > 0
      ? `${unanswered} question(s) not answered. Submit anyway?`
      : 'All questions answered. Ready to submit.',
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}
