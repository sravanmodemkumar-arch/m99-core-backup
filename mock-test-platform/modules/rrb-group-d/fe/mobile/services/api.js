// Calls this module's CF Worker JSON API
const auth = token => token ? { Authorization: `Bearer ${token}` } : {}
const json = body  => ({ 'Content-Type': 'application/json', ...body })

export const fetchConfig = (base) =>
  fetch(`${base}/config`).then(r => r.json())

export const fetchTSF = (base, testId, token) =>
  fetch(`${base}/${testId}`, { headers: auth(token) }).then(r => r.json())

export const saveAnswer = (base, testId, token, qno, selected) =>
  fetch(`${base}/${testId}/answer`, {
    method : 'POST',
    headers: json(auth(token)),
    body   : JSON.stringify({ qno, selected }),
  })

export const clearAnswer = (base, testId, token, qno) =>
  fetch(`${base}/${testId}/answer`, {
    method : 'POST',
    headers: json(auth(token)),
    body   : JSON.stringify({ qno, action: 'clear' }),
  })

export const toggleFlag = (base, testId, token, qno) =>
  fetch(`${base}/${testId}/flag`, {
    method : 'POST',
    headers: json(auth(token)),
    body   : JSON.stringify({ qno }),
  })

export const batchResults = (base, token, results) =>
  fetch(`${base}/results/batch`, {
    method : 'POST',
    headers: json(auth(token)),
    body   : JSON.stringify({ results }),
  })
