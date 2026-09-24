// libSQL (SQLite) database: Turso in production, a local file in development.
// The schema is created on first use; statements are idempotent.
import 'server-only';
import { createClient, type Client, type InArgs, type Row } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export const EMBED_DIMS = 384;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL, system_prompt TEXT NOT NULL,
    temperature REAL NOT NULL DEFAULT 0.2, top_k INTEGER NOT NULL DEFAULT 5,
    allow_general INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, chars INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL, text TEXT NOT NULL, embedding F32_BLOB(${EMBED_DIMS}))`,
  `CREATE INDEX IF NOT EXISTS chunks_vec ON chunks (libsql_vector_idx(embedding, 'metric=cosine'))`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, context TEXT, trace TEXT, model TEXT,
    latency_ms INTEGER, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS golden_items (
    id INTEGER PRIMARY KEY, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    question TEXT NOT NULL, reference TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
    source_message_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS rubrics (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, criteria TEXT NOT NULL, rules TEXT NOT NULL DEFAULT '',
    pass_threshold REAL NOT NULL DEFAULT 4, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, agent_id INTEGER NOT NULL REFERENCES agents(id),
    rubric_id INTEGER NOT NULL REFERENCES rubrics(id), source TEXT NOT NULL, judges TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', total INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
    error TEXT, summary TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE, position INTEGER NOT NULL,
    question TEXT NOT NULL, reference TEXT, answer TEXT, context TEXT, golden_item_id INTEGER, message_id INTEGER,
    latency_ms INTEGER, tokens_in INTEGER, tokens_out INTEGER, judgments TEXT, status TEXT NOT NULL DEFAULT 'pending', error TEXT)`,
  `CREATE INDEX IF NOT EXISTS results_run ON results (run_id, position)`,
  `CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY, result_id INTEGER NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    annotator TEXT NOT NULL, pass INTEGER NOT NULL, scores TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (result_id, annotator))`,
];

let client: Client | null = null;
let ready: Promise<void> | null = null;

function localUrl() {
  // On Vercel only /tmp is writable (and it is wiped between cold starts).
  const dir = config.onVercel ? '/tmp' : path.join(process.cwd(), '.data');
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, 'lab.db')}`;
}

export async function db(): Promise<Client> {
  if (!client) {
    client = config.tursoUrl
      ? createClient({ url: config.tursoUrl, authToken: config.tursoToken })
      : createClient({ url: localUrl() });
    ready = (async () => {
      await client!.execute('PRAGMA foreign_keys = ON');
      await client!.batch(SCHEMA, 'write');
      const { seed } = await import('./seed');
      await seed(client!);
    })();
  }
  await ready;
  return client;
}

/** Rows as plain objects of type T. */
export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const r = await (await db()).execute({ sql, args });
  return r.rows.map((row: Row) => ({ ...row }) as T);
}

export async function one<T>(sql: string, args: InArgs = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: InArgs = []) {
  const r = await (await db()).execute({ sql, args });
  return { id: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
}

export const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string' || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
