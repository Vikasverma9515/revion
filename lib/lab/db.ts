// The lab database: real SQLite (sql.js, WebAssembly) running in the browser,
// saved to IndexedDB after every write. No server or external database is
// involved, so it works the same locally and on Vercel. The data belongs to
// this browser; use export / import to move it.
import initSqlJs, { type Database } from 'sql.js';
import { seed } from './seed';

type Value = string | number | null;

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, model TEXT NOT NULL, system_prompt TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.2, top_k INTEGER NOT NULL DEFAULT 5,
  allow_general INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER NOT NULL REFERENCES agents(id), title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL, context TEXT, trace TEXT, model TEXT,
  latency_ms INTEGER, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS golden_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  question TEXT NOT NULL, reference TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
  source_message_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, criteria TEXT NOT NULL, rules TEXT NOT NULL DEFAULT '',
  pass_threshold REAL NOT NULL DEFAULT 4, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, agent_id INTEGER NOT NULL REFERENCES agents(id),
  rubric_id INTEGER NOT NULL REFERENCES rubrics(id), source TEXT NOT NULL, judges TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', total INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
  error TEXT, summary TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE, position INTEGER NOT NULL,
  question TEXT NOT NULL, reference TEXT, answer TEXT, context TEXT, golden_item_id INTEGER, message_id INTEGER,
  latency_ms INTEGER, tokens_in INTEGER, tokens_out INTEGER, judgments TEXT, status TEXT NOT NULL DEFAULT 'pending', error TEXT);
CREATE INDEX IF NOT EXISTS results_run ON results (run_id, position);
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, result_id INTEGER NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  annotator TEXT NOT NULL, pass INTEGER NOT NULL, scores TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (result_id, annotator));
`;

// ---------- IndexedDB persistence ----------
const IDB_NAME = 'revion-eval-lab';
const IDB_KEY = 'lab.sqlite';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(): Promise<Uint8Array | null> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const req = d.transaction('files').objectStore('files').get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function store(bytes: Uint8Array | null) {
  const d = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction('files', 'readwrite');
    if (bytes) tx.objectStore('files').put(bytes, IDB_KEY);
    else tx.objectStore('files').delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- the database ----------
let instance: Promise<Database> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function open(bytes?: Uint8Array | null): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
  const d = bytes ? new SQL.Database(bytes) : new SQL.Database();
  d.exec(SCHEMA);
  seed(d);
  return d;
}

export function db(): Promise<Database> {
  if (typeof window === 'undefined') throw new Error('The lab database runs in the browser.');
  if (!instance) {
    instance = load().then(open);
    instance.then(
      () => scheduleSave(),
      () => (instance = null), // allow a retry after a failed start
    );
    if (typeof addEventListener === 'function') addEventListener('pagehide', () => flush());
  }
  return instance;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 200);
}

async function flush() {
  if (!instance) return;
  saveTimer = null;
  await store((await instance).export());
}

export async function all<T>(sql: string, args: Value[] = []): Promise<T[]> {
  const d = await db();
  const stmt = d.prepare(sql);
  try {
    stmt.bind(args);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export async function one<T>(sql: string, args: Value[] = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: Value[] = []) {
  const d = await db();
  d.run(sql, args);
  const changes = d.getRowsModified();
  const id = Number(d.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0);
  scheduleSave();
  return { id, changes };
}

/** Several writes in one transaction. */
export async function batch(stmts: { sql: string; args: Value[] }[]) {
  const d = await db();
  d.exec('BEGIN');
  try {
    for (const s of stmts) d.run(s.sql, s.args);
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
  scheduleSave();
}

// ---------- export / import / reset ----------
export async function exportDb(): Promise<Uint8Array> {
  return (await db()).export();
}

export async function importDb(bytes: Uint8Array) {
  const fresh = await open(bytes); // throws if the file is not a SQLite database
  fresh.exec('SELECT COUNT(*) FROM agents');
  instance = Promise.resolve(fresh);
  await flush();
}

export async function resetDb() {
  instance = open(null);
  await flush();
}

export const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string' || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
