// Same 4 results OR 24h logic as web
import { getQueue, clearQueue, getLastFlush, setLastFlush } from './storage'
import { batchResults } from './api'

const BATCH_SIZE = 4
const MAX_HOURS  = 24

export async function checkAndFlush(moduleApi, token) {
  const queue = await getQueue()
  if (queue.length === 0) return

  const last       = await getLastFlush()
  const hoursSince = last ? (Date.now() - new Date(last)) / 36e5 : 999
  if (queue.length < BATCH_SIZE && hoursSince < MAX_HOURS) return

  try {
    await batchResults(moduleApi, token, queue)
    await clearQueue()
    await setLastFlush(new Date().toISOString())
  } catch {
    // silent — retry on next foreground resume
  }
}
