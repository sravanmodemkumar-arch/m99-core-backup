// Batch sync — 4 results OR 24h, checked on every page load
import { getQueue, clearQueue, getLastFlush, setLastFlush } from './storage.js'

const BATCH_SIZE = 4
const MAX_HOURS  = 24

export async function checkAndFlush(moduleApi, token) {
  const queue = await getQueue()
  if (queue.length === 0) return

  const last        = await getLastFlush()
  const hoursSince  = last ? (Date.now() - new Date(last)) / 36e5 : 999
  const shouldFlush = queue.length >= BATCH_SIZE || hoursSince >= MAX_HOURS
  if (!shouldFlush) return

  try {
    await fetch(`${moduleApi}/results/batch`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body   : JSON.stringify({ results: queue }),
    })
    await clearQueue()
    await setLastFlush(new Date().toISOString())
  } catch {
    // silent — retry on next page open
  }
}

export async function enqueueResult(storage, result) {
  const { enqueue } = storage
  await enqueue(result)
}
