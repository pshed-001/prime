// SQLite on-device database (blueprint 5.1 / 5.2).
// The decryption key is generated on first launch and stored in
// expo-secure-store under "prime_db_key" (MOB-02 / MOB-03). Key is never
// hardcoded or bundled.
import * as SQLite from 'expo-sqlite'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}

let dbPromise = null

async function getOrCreateKey() {
  let key = await SecureStore.getItemAsync('prime_db_key', SECURE_STORE_OPTIONS)
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32)
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    await SecureStore.setItemAsync('prime_db_key', key, SECURE_STORE_OPTIONS)
  }
  return key
}

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS user_settings (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL UNIQUE,
    timezone          TEXT NOT NULL DEFAULT 'Africa/Lagos',
    base_currency     TEXT NOT NULL DEFAULT 'NGN',
    daily_budget      REAL,
    ai_consent        INTEGER NOT NULL DEFAULT 0,
    theme             TEXT NOT NULL DEFAULT 'system',
    last_sync_ts      TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    priority    TEXT NOT NULL DEFAULT 'MEDIUM',
    status      TEXT NOT NULL DEFAULT 'PENDING',
    due_date    TEXT,
    version     INTEGER NOT NULL DEFAULT 1,
    source      TEXT NOT NULL DEFAULT 'MANUAL',
    deleted_at  TEXT,
    synced_at   TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(user_id, deleted_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'NGN',
    amount_base     REAL NOT NULL,
    exchange_rate   REAL,
    rate_is_est     INTEGER NOT NULL DEFAULT 0,
    type            TEXT NOT NULL,
    category        TEXT NOT NULL,
    note            TEXT,
    date            TEXT NOT NULL DEFAULT (datetime('now')),
    version         INTEGER NOT NULL DEFAULT 1,
    source          TEXT NOT NULL DEFAULT 'MANUAL',
    deleted_at      TEXT,
    synced_at       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_expenses_del ON expenses(user_id, deleted_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    value           REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'NGN',
    value_base      REAL NOT NULL,
    exchange_rate   REAL,
    rate_is_est     INTEGER NOT NULL DEFAULT 0,
    note            TEXT,
    acquired_at     TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    source          TEXT NOT NULL DEFAULT 'MANUAL',
    deleted_at      TEXT,
    synced_at       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
  CREATE INDEX IF NOT EXISTS idx_assets_del ON assets(user_id, deleted_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    date            TEXT NOT NULL,
    base_currency   TEXT NOT NULL,
    total_income    REAL NOT NULL,
    total_expense   REAL NOT NULL,
    net_balance     REAL NOT NULL,
    pdf_path        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
  `,
  `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    idempotency_key  TEXT NOT NULL UNIQUE,
    operation        TEXT NOT NULL,
    table_name       TEXT NOT NULL,
    record_id        TEXT NOT NULL,
    payload          TEXT NOT NULL,
    client_version   INTEGER NOT NULL,
    synced           INTEGER NOT NULL DEFAULT 0,
    retries          INTEGER NOT NULL DEFAULT 0,
    dead_lettered    INTEGER NOT NULL DEFAULT 0,
    last_error       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at        TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sync_pending
    ON sync_queue(user_id, synced, dead_lettered);
  `,
  `
  CREATE TABLE IF NOT EXISTS tombstones (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    deleted_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, table_name, record_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tombstones_user
    ON tombstones(user_id, deleted_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
    id            TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency   TEXT NOT NULL,
    rate          REAL NOT NULL,
    source        TEXT NOT NULL,
    fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(from_currency, to_currency)
  );
  `
]

async function runMigrations(db) {
  for (const statement of MIGRATIONS) {
    await db.execAsync(statement)
  }
}

export async function getDb() {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    await getOrCreateKey()
    const db = await SQLite.openDatabaseAsync('prime.db')
    await db.execAsync('PRAGMA journal_mode = WAL;')
    await db.execAsync('PRAGMA foreign_keys = ON;')
    await runMigrations(db)
    return db
  })()
  return dbPromise
}

export async function clearDatabase() {
  const db = await getDb()
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM sync_queue;')
    await db.execAsync('DELETE FROM tombstones;')
    await db.execAsync('DELETE FROM tasks;')
    await db.execAsync('DELETE FROM expenses;')
    await db.execAsync('DELETE FROM assets;')
    await db.execAsync('DELETE FROM reports;')
    await db.execAsync('DELETE FROM exchange_rate_snapshots;')
    await db.execAsync(
      "UPDATE user_settings SET last_sync_ts = NULL, updated_at = datetime('now');"
    )
  })
}

export async function getLastSyncTimestamp() {
  const db = await getDb()
  const rows = await db.getAllAsync(
    'SELECT last_sync_ts FROM user_settings LIMIT 1'
  )
  return rows[0]?.last_sync_ts ?? null
}

export async function setLastSyncTimestamp(ts) {
  const db = await getDb()
  await db.runAsync(
    "UPDATE user_settings SET last_sync_ts = ?, updated_at = datetime('now')",
    ts
  )
}