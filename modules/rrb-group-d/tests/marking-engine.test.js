import { describe, it, expect } from 'vitest'
import { computeResult, previewScore } from '../src/marking-engine.js'
import { buildTSF, saveAnswer } from '../src/tsf-builder.js'

// 100 dummy QIDs for testing
const DUMMY_QIDS = Array.from({ length: 100 }, (_, i) =>
  `MATH-01-01-S-M-C-${String(i + 1).padStart(6, '0')}`
)

const DUMMY_TSF = buildTSF({
  test_id     : 'TST-TEST-001',
  year        : '2024',
  tenant_id   : 'test-tenant',
  candidate   : { uid: 'U-001', name: 'Test Student', roll_no: 'RRB-001', photo_url: null },
  question_ids: DUMMY_QIDS,
  is_mock     : true,
  canary      : false,
  cen         : 'CEN-RRC-01/2024',
})

// Answer key: all questions → answer "B"
const ANSWER_KEY = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => [i + 1, ['B']])
)

describe('Marking Engine — RRB Group D', () => {

  it('correct answer scores +1', () => {
    const tsf = saveAnswer(DUMMY_TSF, 1, ['B'])
    const result = computeResult(tsf, ANSWER_KEY)
    expect(result.per_question[1].status).toBe('correct')
    expect(result.per_question[1].earned).toBe(1)
  })

  it('wrong answer scores -0.33', () => {
    const tsf = saveAnswer(DUMMY_TSF, 1, ['A'])
    const result = computeResult(tsf, ANSWER_KEY)
    expect(result.per_question[1].status).toBe('wrong')
    expect(result.per_question[1].earned).toBe(-0.33)
  })

  it('unattempted scores 0', () => {
    const result = computeResult(DUMMY_TSF, ANSWER_KEY)
    expect(result.per_question[1].status).toBe('unattempted')
    expect(result.per_question[1].earned).toBe(0)
  })

  it('all correct = 100 marks', () => {
    let tsf = DUMMY_TSF
    for (let q = 1; q <= 100; q++) {
      tsf = saveAnswer(tsf, q, ['B'])
    }
    const result = computeResult(tsf, ANSWER_KEY)
    expect(result.score).toBe(100)
    expect(result.correct_count).toBe(100)
    expect(result.wrong_count).toBe(0)
  })

  it('all wrong = -33 marks', () => {
    let tsf = DUMMY_TSF
    for (let q = 1; q <= 100; q++) {
      tsf = saveAnswer(tsf, q, ['A']) // all wrong
    }
    const result = computeResult(tsf, ANSWER_KEY)
    expect(result.score).toBe(-33)
    expect(result.wrong_count).toBe(100)
  })

  it('score is never below -33 for 100 wrongs', () => {
    let tsf = DUMMY_TSF
    for (let q = 1; q <= 100; q++) tsf = saveAnswer(tsf, q, ['D'])
    const result = computeResult(tsf, ANSWER_KEY)
    expect(result.score).toBeGreaterThanOrEqual(-34) // rounding tolerance
  })

  it('section scores sum to total score', () => {
    let tsf = DUMMY_TSF
    for (let q = 1; q <= 50; q++) tsf = saveAnswer(tsf, q, ['B'])
    const result = computeResult(tsf, ANSWER_KEY)
    const sectionTotal = result.per_section.reduce((sum, s) => sum + s.score, 0)
    expect(Math.round(sectionTotal * 100)).toBe(Math.round(result.score * 100))
  })

  it('preview shows unanswered count', () => {
    let tsf = DUMMY_TSF
    tsf = saveAnswer(tsf, 1, ['B'])
    tsf = saveAnswer(tsf, 2, ['A'])
    const preview = previewScore(tsf)
    expect(preview.answered).toBe(2)
    expect(preview.unanswered).toBe(98)
  })
})
