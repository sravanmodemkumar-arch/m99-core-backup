// IndexedDB — result queue + meta
// Same schema as mobile (expo-sqlite) and desktop (better-sqlite3)

let _db = null

async function db() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rrb-group-d', 1)
    req.onupgradeneeded = e => {
      const d = e.target.result
      if (!d.objectStoreNames.contains('result_queue')) {
        d.createObjectStore('result_queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!d.objectStoreNames.contains('meta')) {
        d.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror  = () => reject(req.error)
  })
}

function tx(store, mode, fn) {
  return new Promise(async (resolve, reject) => {
    const d   = await db()
    const tr  = d.transaction(store, mode)
    const req = fn(tr.objectStore(store))
    tr.oncomplete = () => resolve(req?.result)
    tr.onerror    = () => reject(tr.error)
  })
}

export const enqueue  = result => tx('result_queue', 'readwrite', s => s.add(result))
export const getQueue = ()     => tx('result_queue', 'readonly',  s => s.getAll())
export const clearQueue = ()   => tx('result_queue', 'readwrite', s => s.clear())

export async function getLastFlush() {
  const d   = await db()
  return new Promise((resolve, reject) => {
    const req = d.transaction('meta', 'readonly').objectStore('meta').get('last_flush')
    req.onsuccess = () => resolve(req.result?.value ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function setLastFlush(ts) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tr = d.transaction('meta', 'readwrite')
    tr.objectStore('meta').put({ key: 'last_flush', value: ts })
    tr.oncomplete = resolve
    tr.onerror    = () => reject(tr.error)
  })
}
