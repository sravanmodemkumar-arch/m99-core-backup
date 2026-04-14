import { describe, it, expect } from 'vitest'
import { buildTSF, startTest, saveAnswer, clearAnswer, toggleFlag, getQuestionState } from '../backend/tsf.js'
import { EXAM_PATTERN, Q_STATE, TEST_STATUS } from '../backend/config.js'

const DUMMY_QIDS = Array.from({ length: 100 }, (_, i) =>
  `MATH-01-01-S-M-C-${String(i + 1).padStart(6, '0')}`
)

const BASE_OPTS = {
  test_id     : 'TST-GRPD-001',
  year        : '2024',
  tenant_id   : 'allen',
  candidate   : { uid: 'U-001', name: 'Ravi Kumar', roll_no: 'RRB24-001', photo_url: null },
  question_ids: DUMMY_QIDS,
  is_mock     : true,
  canary      : false,
  cen         : 'CEN-RRC-01/2024',
}

describe('TSF Builder', () => {

  it('builds TSF with correct structure', () => {
    const tsf = buildTSF(BASE_OPTS)
    expect(tsf.tsf_version).toBe('1.0.0')
    expect(tsf.exam_id).toBe('RRB-GROUP-D-2024')
    expect(tsf.questions).toHaveLength(100)
    expect(tsf.sections).toHaveLength(4)
    expect(tsf.state.status).toBe(TEST_STATUS.NOT_STARTED)
  })

  it('throws if wrong question count', () => {
    expect(() => buildTSF({ ...BASE_OPTS, question_ids: ['Q1', 'Q2'] })).toThrow()
  })

  it('section Q ranges are correct', () => {
    const tsf = buildTSF(BASE_OPTS)
    const s1  = tsf.questions.filter(q => q.sid === 'S1')
    const s2  = tsf.questions.filter(q => q.sid === 'S2')
    const s3  = tsf.questions.filter(q => q.sid === 'S3')
    const s4  = tsf.questions.filter(q => q.sid === 'S4')
    expect(s1).toHaveLength(25)  // Mathematics
    expect(s2).toHaveLength(30)  // Reasoning
    expect(s3).toHaveLength(25)  // Science
    expect(s4).toHaveLength(20)  // GK
  })

  it('startTest sets status + timestamps', () => {
    const tsf     = buildTSF(BASE_OPTS)
    const started = startTest(tsf)
    expect(started.state.status).toBe(TEST_STATUS.IN_PROGRESS)
    expect(started.schedule.start_at).toBeTruthy()
    expect(started.schedule.end_at).toBeTruthy()
    expect(started.state.visited).toContain(1) // Q1 auto-visited
  })

  it('saveAnswer marks question as answered', () => {
    const tsf     = buildTSF(BASE_OPTS)
    const updated = saveAnswer(tsf, 1, ['B'])
    expect(updated.state.answers[1].v).toEqual(['B'])
    expect(updated.state.visited).toContain(1)
  })

  it('clearAnswer removes answer', () => {
    let tsf = buildTSF(BASE_OPTS)
    tsf = saveAnswer(tsf, 1, ['B'])
    tsf = clearAnswer(tsf, 1)
    expect(tsf.state.answers[1]).toBeUndefined()
  })

  it('toggleFlag sets and unsets flag', () => {
    let tsf = buildTSF(BASE_OPTS)
    tsf = toggleFlag(tsf, 5)
    expect(tsf.state.flags[5]).toBe(true)
    tsf = toggleFlag(tsf, 5)
    expect(tsf.state.flags[5]).toBeUndefined()
  })

  it('question state machine returns correct states', () => {
    let tsf = buildTSF(BASE_OPTS)

    // Not visited
    expect(getQuestionState(tsf.state, 1)).toBe(Q_STATE.NOT_VISITED)

    // Visited but not answered
    tsf = { ...tsf, state: { ...tsf.state, visited: [1] } }
    expect(getQuestionState(tsf.state, 1)).toBe(Q_STATE.NOT_ANSWERED)

    // Answered
    tsf = saveAnswer(tsf, 1, ['C'])
    expect(getQuestionState(tsf.state, 1)).toBe(Q_STATE.ANSWERED)

    // Answered + flagged
    tsf = toggleFlag(tsf, 1)
    expect(getQuestionState(tsf.state, 1)).toBe(Q_STATE.ANSWERED_MARKED)

    // Flagged only (clear answer, keep flag)
    tsf = clearAnswer(tsf, 1)
    expect(getQuestionState(tsf.state, 1)).toBe(Q_STATE.MARKED_REVIEW)
  })

  it('integrity block has module info', () => {
    const tsf = buildTSF(BASE_OPTS)
    expect(tsf.integrity.module_id).toBe('rrb-group-d')
    expect(tsf.integrity.is_mock).toBe(true)
    expect(tsf.integrity.q_count).toBe(100)
    expect(tsf.integrity.q_hash).toBeTruthy()
  })
})
