// Knowledge base: documents are split into overlapping chunks, embedded
// locally and stored in libSQL with a vector index for top-k search.
import 'server-only';
import { all, db, one, run } from './db';
import { embed } from './embed';

export type Doc = { id: number; title: string; source: string; chars: number; chunks: number; created_at: string };
export type Hit = { chunk_id: number; document_id: number; title: string; text: string; distance: number };

/** Split on paragraphs, packing them into ~900-char chunks with one paragraph of overlap. */
export function chunkText(text: string, target = 900): string[] {
  const paras = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > target * 1.5 ? p.match(new RegExp(`[\\s\\S]{1,${target}}(\\s|$)`, 'g')) ?? [p] : [p]));
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const p of paras) {
    if (len + p.length > target && cur.length) {
      chunks.push(cur.join('\n\n'));
      const last = cur[cur.length - 1];
      cur = last.length < target / 3 ? [last] : [];
      len = cur.reduce((a, s) => a + s.length, 0);
    }
    cur.push(p.trim());
    len += p.length;
  }
  if (cur.length) chunks.push(cur.join('\n\n'));
  return chunks;
}

export async function addDocument(title: string, source: string, text: string) {
  const clean = text.replace(/\u0000/g, '').trim();
  if (clean.length < 20) throw new Error('The document has no usable text.');
  const chunks = chunkText(clean);
  const vectors = await embed(chunks);
  const { id } = await run('INSERT INTO documents (title, source, chars) VALUES (?, ?, ?)', [title, source, clean.length]);
  const client = await db();
  await client.batch(
    chunks.map((c, i) => ({
      sql: 'INSERT INTO chunks (document_id, idx, text, embedding) VALUES (?, ?, ?, vector32(?))',
      args: [id, i, c, JSON.stringify(vectors[i])],
    })),
    'write',
  );
  return { id, chunks: chunks.length };
}

export async function listDocuments(): Promise<Doc[]> {
  return all<Doc>(
    `SELECT d.*, (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunks FROM documents d ORDER BY d.id DESC`,
  );
}

export async function deleteDocument(id: number) {
  await run('DELETE FROM chunks WHERE document_id = ?', [id]);
  await run('DELETE FROM documents WHERE id = ?', [id]);
}

export async function documentCount() {
  return Number((await one<{ n: number }>('SELECT COUNT(*) AS n FROM documents'))?.n ?? 0);
}

export async function search(query: string, k = 5): Promise<Hit[]> {
  const [q] = await embed([query]);
  const v = JSON.stringify(q);
  return all<Hit>(
    `SELECT c.id AS chunk_id, c.document_id, d.title, c.text, vector_distance_cos(c.embedding, vector32(?)) AS distance
     FROM vector_top_k('chunks_vec', vector32(?), ?) AS t
     JOIN chunks c ON c.rowid = t.id JOIN documents d ON d.id = c.document_id
     ORDER BY distance`,
    [v, v, k],
  );
}

/** Extract plain text from an uploaded file (txt, md, csv, json, pdf). */
export async function fileToText(name: string, bytes: Uint8Array): Promise<string> {
  if (name.toLowerCase().endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  return new TextDecoder().decode(bytes);
}

/** Fetch a web page and reduce it to readable text. */
export async function urlToText(url: string): Promise<{ title: string; text: string }> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are supported.');
  // Refuse obvious internal addresses so the server cannot be used to probe its own network.
  if (/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|metadata\.)/i.test(u.hostname)) {
    throw new Error('Private and internal addresses are not allowed.');
  }
  const res = await fetch(u, { headers: { 'user-agent': 'RevionEvalLab/1.0' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Fetching the page failed (${res.status}).`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || u.hostname;
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*(\n\s*)+/g, '\n\n')
    .trim();
  return { title, text };
}

/** Load the starter documents once (skips titles that already exist). */
export async function loadStarterKnowledge() {
  const { starterDocuments } = await import('./seed');
  const existing = new Set((await listDocuments()).map((d) => d.title));
  let added = 0;
  for (const d of starterDocuments()) {
    if (existing.has(d.title)) continue;
    await addDocument(d.title, d.source, d.text);
    added++;
  }
  return added;
}
