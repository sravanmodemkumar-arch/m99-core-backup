import { enqueue, getQueue, getLastFlush, setLastFlush, clearQueue } from './storage.js'
import { checkAndFlush } from './sync.js'

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  tsf       : null,   // full Test Session File
  config    : null,   // exam pattern config
  bundle    : null,   // mock bundle (all questions + answer key)
  currentQ  : 1,
  lang      : 'en',   // 'en' | 'hi'
  token     : null,
  moduleApi : null,
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  const params    = new URLSearchParams(location.search)
  state.token     = params.get('token')
  state.moduleApi = params.get('api') ?? '/exam/rrb-group-d'
  const testId    = params.get('test_id')
  const bundleUrl = params.get('bundle')

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }

  // Flush any pending results from previous sessions
  await checkAndFlush(state.moduleApi, state.token)

  try {
    // Load config + bundle in parallel
    const [configRes, bundleRes, tsfRes] = await Promise.all([
      fetch(`${state.moduleApi}/config`).then(r => r.json()),
      bundleUrl ? fetch(bundleUrl).then(r => r.json()) : Promise.resolve(null),
      testId
        ? fetch(`${state.moduleApi}/${testId}`, { headers: auth() }).then(r => r.json())
        : Promise.resolve(null),
    ])

    state.config = configRes
    state.bundle = bundleRes
    state.tsf    = tsfRes

    renderShell()
    renderPaletteLegend()
    renderPalette()
    renderSectionTabs()
    await loadQuestion(state.currentQ)
    startTimer(state.config.schedule.duration_sec)

    document.getElementById('loading').classList.add('hidden')
    document.getElementById('shell').classList.remove('hidden')
  } catch (err) {
    document.getElementById('loading').innerHTML =
      `<p class="text-red-500">Failed to load exam. Please refresh.</p>`
  }
})

// ─── Shell Render ─────────────────────────────────────────────────────────────
function renderShell() {
  const cfg = state.config
  document.getElementById('exam-name').textContent =
    cfg.header.exam_name.en + ' — ' + cfg.header.post_name.en
  document.getElementById('candidate-info').textContent =
    state.tsf?.candidate?.name ?? ''
}

function renderSectionTabs() {
  const el = document.getElementById('section-tabs')
  el.innerHTML = state.config.sections.map(s => `
    <button
      onclick="jumpToSection('${s.sid}')"
      class="text-xs px-2 py-1 rounded bg-white bg-opacity-20 hover:bg-opacity-30 text-white transition"
    >${s.label.en}</button>
  `).join('')
}

// ─── Timer ────────────────────────────────────────────────────────────────────
let timerInterval = null

function startTimer(totalSec) {
  let remaining = totalSec
  const el      = document.getElementById('timer')

  timerInterval = setInterval(() => {
    remaining--
    el.textContent = formatTime(remaining)

    if (remaining < 300) el.className = 'font-mono font-bold text-lg text-red-300'
    else if (remaining < 600) el.className = 'font-mono font-bold text-lg text-yellow-300'

    if (remaining <= 0) {
      clearInterval(timerInterval)
      submitExam()
    }
  }, 1000)
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ─── Question Loading ─────────────────────────────────────────────────────────
async function loadQuestion(qno) {
  state.currentQ = qno
  document.getElementById('q-number').textContent = `Question ${qno}`
  document.getElementById('q-loading').classList.remove('hidden')
  document.getElementById('q-text-en').textContent = ''
  document.getElementById('q-text-hi').textContent = ''
  document.getElementById('q-options').innerHTML   = ''

  let qContent
  if (state.bundle) {
    // Mock bundle — all questions embedded
    qContent = state.bundle.questions[qno]
  } else {
    // Fetch from CDN on demand
    const qid = state.tsf.questions.find(q => q.qno === qno)?.qid
    qContent  = await fetch(`${state.bundle?.cdn_base ?? ''}/questions/${qid}.json`).then(r => r.json())
  }

  document.getElementById('q-loading').classList.add('hidden')
  document.getElementById('q-text-en').textContent = qContent.text_en
  document.getElementById('q-text-hi').textContent = qContent.text_hi

  const answered = state.tsf?.state?.answers?.[qno]?.v ?? []
  document.getElementById('q-options').innerHTML = qContent.options.map(opt => `
    <label class="flex items-start gap-3 p-3 rounded border cursor-pointer transition
      ${answered.includes(opt.key) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}">
      <input type="radio" name="q${qno}" value="${opt.key}"
        ${answered.includes(opt.key) ? 'checked' : ''}
        onchange="selectOption('${opt.key}')"
        class="mt-1 accent-blue-600">
      <span class="font-semibold text-gray-700 w-5">${opt.key}.</span>
      <span class="text-gray-800">
        <span class="q-opt-en">${opt.text_en}</span>
        <span class="q-opt-hi hidden">${opt.text_hi}</span>
      </span>
    </label>
  `).join('')

  renderPalette()
  updateSummary()
}

// ─── Answer Actions ───────────────────────────────────────────────────────────
window.selectOption = function(key) {
  if (!state.tsf) return
  const qno = state.currentQ
  state.tsf.state.answers[qno] = { v: [key] }
  if (!state.tsf.state.visited.includes(qno)) state.tsf.state.visited.push(qno)
  // Push to CF Worker (fire and forget)
  fetch(`${state.moduleApi}/${state.tsf.test_id}/answer`, {
    method : 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body   : JSON.stringify({ qno, selected: [key] }),
  }).catch(() => {})
  renderPalette()
  updateSummary()
}

window.clearResponse = function() {
  const qno = state.currentQ
  if (!state.tsf?.state?.answers?.[qno]) return
  delete state.tsf.state.answers[qno]
  fetch(`${state.moduleApi}/${state.tsf.test_id}/answer`, {
    method : 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body   : JSON.stringify({ qno, action: 'clear' }),
  }).catch(() => {})
  loadQuestion(qno)
}

window.markReview = function() {
  const qno = state.currentQ
  state.tsf.state.flags[qno] = !state.tsf.state.flags[qno]
  if (!state.tsf.state.flags[qno]) delete state.tsf.state.flags[qno]
  fetch(`${state.moduleApi}/${state.tsf.test_id}/flag`, {
    method : 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body   : JSON.stringify({ qno }),
  }).catch(() => {})
  navigate(1)
}

window.saveAndNext = function() { navigate(1) }
window.navigate    = function(dir) {
  const next = state.currentQ + dir
  const max  = state.config.totals.q_count
  if (next >= 1 && next <= max) loadQuestion(next)
}

window.jumpToSection = function(sid) {
  const sec = state.config.sections.find(s => s.sid === sid)
  if (sec) loadQuestion(sec.q_from)
}

window.setLang = function(lang) {
  state.lang = lang
  document.getElementById('q-text-en').classList.toggle('hidden', lang !== 'en')
  document.getElementById('q-text-hi').classList.toggle('hidden', lang !== 'hi')
  document.querySelectorAll('.q-opt-en').forEach(el => el.classList.toggle('hidden', lang !== 'en'))
  document.querySelectorAll('.q-opt-hi').forEach(el => el.classList.toggle('hidden', lang !== 'hi'))
  document.getElementById('lang-en').className = lang === 'en'
    ? 'px-2 py-1 rounded border border-blue-400 text-blue-600 font-medium'
    : 'px-2 py-1 rounded border border-gray-300 text-gray-500'
  document.getElementById('lang-hi').className = lang === 'hi'
    ? 'px-2 py-1 rounded border border-blue-400 text-blue-600 font-medium'
    : 'px-2 py-1 rounded border border-gray-300 text-gray-500'
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const STATE_COLORS = {
  not_visited    : 'bg-notvisit text-white',
  not_answered   : 'bg-wrong text-white',
  answered       : 'bg-answered text-white',
  marked_review  : 'bg-review text-white',
  answered_marked: 'bg-reviewed text-white',
}

function qState(qno) {
  if (!state.tsf) return 'not_visited'
  const visited  = state.tsf.state.visited.includes(qno)
  const answered = !!state.tsf.state.answers?.[qno]
  const flagged  = !!state.tsf.state.flags?.[qno]
  if (!visited)             return 'not_visited'
  if (answered && flagged)  return 'answered_marked'
  if (answered)             return 'answered'
  if (flagged)              return 'marked_review'
  return 'not_answered'
}

function renderPalette() {
  const container = document.getElementById('palette-container')
  container.innerHTML = state.config.sections.map(sec => `
    <div class="mb-3">
      <div class="text-xs font-semibold text-gray-500 mb-1">${sec.label.en}</div>
      <div class="grid grid-cols-5 gap-1">
        ${Array.from({ length: sec.q_count }, (_, i) => {
          const qno = sec.q_from + i
          const st  = qState(qno)
          const cur = qno === state.currentQ ? 'ring-2 ring-yellow-400' : ''
          return `<button onclick="loadQuestion(${qno})"
            class="w-8 h-8 text-xs rounded font-medium ${STATE_COLORS[st]} ${cur} hover:opacity-80 transition">
            ${qno}
          </button>`
        }).join('')}
      </div>
    </div>
  `).join('')
}

function renderPaletteLegend() {
  document.getElementById('palette-legend').innerHTML = [
    ['bg-answered text-white',  'Answered'],
    ['bg-wrong text-white',     'Not Answered'],
    ['bg-notvisit text-white',  'Not Visited'],
    ['bg-review text-white',    'Marked for Review'],
    ['bg-reviewed text-white',  'Answered & Marked'],
  ].map(([cls, label]) => `
    <div class="flex items-center gap-2">
      <span class="w-5 h-5 rounded text-xs flex items-center justify-center ${cls}"></span>
      <span>${label}</span>
    </div>
  `).join('')
}

function updateSummary() {
  if (!state.tsf) return
  const answers     = state.tsf.state.answers ?? {}
  const flags       = state.tsf.state.flags ?? {}
  const answered    = Object.keys(answers).length
  const flagged     = Object.keys(flags).length
  const total       = state.config.totals.q_count
  document.getElementById('sidebar-summary').innerHTML = `
    <div>Answered: <strong>${answered}</strong></div>
    <div>Unanswered: <strong>${total - answered}</strong></div>
    <div>Marked: <strong>${flagged}</strong></div>
  `
}

// ─── Submit ───────────────────────────────────────────────────────────────────
window.openSubmitModal = function() {
  const answers  = state.tsf?.state?.answers ?? {}
  const total    = state.config.totals.q_count
  const answered = Object.keys(answers).length
  document.getElementById('modal-summary').innerHTML = `
    <div>✅ Answered: <strong>${answered}</strong></div>
    <div>❌ Not Answered: <strong>${total - answered}</strong></div>
    <div>🔖 Marked for Review: <strong>${Object.keys(state.tsf?.state?.flags ?? {}).length}</strong></div>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

window.closeSubmitModal = function() {
  document.getElementById('modal-overlay').classList.add('hidden')
}

window.submitExam = async function() {
  clearInterval(timerInterval)
  document.getElementById('modal-overlay').classList.add('hidden')
  document.getElementById('shell').classList.add('hidden')

  // Compute result client-side from bundle answer key
  const answers   = state.tsf?.state?.answers ?? {}
  const answerKey = state.bundle?.answer_key ?? {}
  const marking   = state.config.marking.default

  let score = 0, correct = 0, wrong = 0, unattempted = 0
  const perSection = state.config.sections.map(sec => {
    let ss = 0, sc = 0, sw = 0, su = 0
    for (let qno = sec.q_from; qno <= sec.q_to; qno++) {
      const student = answers[qno]?.v ?? []
      const key     = answerKey[qno] ?? []
      if (student.length === 0) { unattempted++; su++ }
      else if (JSON.stringify([...student].sort()) === JSON.stringify([...key].sort())) {
        score += marking.correct; ss += marking.correct; correct++; sc++
      } else {
        score -= marking.wrong; ss -= marking.wrong; wrong++; sw++
      }
    }
    return { sid: sec.sid, label: sec.label.en, score: ss, correct: sc, wrong: sw, unattempted: su }
  })

  // Queue result for batch sync
  await enqueue({
    test_id     : state.tsf?.test_id ?? 'unknown',
    module_id   : 'rrb-group-d',
    score,
    correct,
    wrong,
    unattempted,
    per_section : JSON.stringify(perSection),
    answers     : JSON.stringify(answers),
    submitted_at: new Date().toISOString(),
  })

  // Flush if threshold hit
  await checkAndFlush(state.moduleApi, state.token)

  // Show result
  showResult({ score, correct, wrong, unattempted, perSection })
}

function showResult({ score, correct, wrong, unattempted, perSection }) {
  const total = state.config.totals.q_count
  document.getElementById('result-screen').classList.remove('hidden')
  document.getElementById('result-score-box').innerHTML = `
    <div class="text-4xl font-bold text-header mb-1">${score.toFixed(2)}</div>
    <div class="text-gray-500 text-sm">out of ${total} marks</div>
    <div class="flex gap-6 mt-4 text-sm">
      <span class="text-green-600">✅ Correct: ${correct}</span>
      <span class="text-red-500">❌ Wrong: ${wrong}</span>
      <span class="text-gray-400">— Unattempted: ${unattempted}</span>
    </div>
  `
  document.getElementById('result-section-table').innerHTML = `
    <table class="w-full text-sm border border-gray-200 rounded overflow-hidden">
      <thead class="bg-gray-50">
        <tr>
          <th class="text-left px-3 py-2">Section</th>
          <th class="px-3 py-2">Score</th>
          <th class="px-3 py-2">Correct</th>
          <th class="px-3 py-2">Wrong</th>
        </tr>
      </thead>
      <tbody>
        ${perSection.map(s => `
          <tr class="border-t border-gray-100">
            <td class="px-3 py-2">${s.label}</td>
            <td class="px-3 py-2 text-center font-medium">${s.score.toFixed(2)}</td>
            <td class="px-3 py-2 text-center text-green-600">${s.correct}</td>
            <td class="px-3 py-2 text-center text-red-500">${s.wrong}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function auth() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {}
}
