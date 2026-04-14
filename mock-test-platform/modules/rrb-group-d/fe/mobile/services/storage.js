// expo-sqlite — same schema as web IndexedDB
import * as SQLite from 'expo-sqlite'

let _db = null

async function getDB() {
  if (_db) return _db
  _db = await SQLite.openDatabaseAsync('rrb-group-d.db')
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS result_queue (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id      TEXT NOT NULL,
      module_id    TEXT NOT NULL,
      score        REAL NOT NULL,
      correct      INTEGER, wrong INTEGER, unattempted INTEGER,
      per_section  TEXT, answers TEXT,
      submitted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT OR IGNORE INTO meta VALUES ('last_flush', NULL);
  `)
  return _db
}

export async function enqueue(result) {
  const db = await getDB()
  await db.runAsync(
    `INSERT INTO result_queue (test_id, module_id, score, correct, wrong, unattempted, per_section, answers, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [result.test_id, result.module_id, result.score, result.correct, result.wrong,
     result.unattempted, result.per_section, result.answers, result.submitted_at]
  )
}

export async function getQueue() {
  const db = await getDB()
  return db.getAllAsync('SELECT * FROM result_queue ORDER BY id ASC')
}

export async function clearQueue() {
  const db = await getDB()
  await db.runAsync('DELETE FROM result_queue')
}

export async function getLastFlush() {
  const db  = await getDB()
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['last_flush'])
  return row?.value ?? null
}

export async function setLastFlush(ts) {
  const db = await getDB()
  await db.runAsync('INSERT OR REPLACE INTO meta VALUES (?, ?)', ['last_flush', ts])
}
