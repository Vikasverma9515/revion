// Knowledge base: list, add (file upload, URL or pasted text), delete.
import { handle, str } from '#/lib/lab/api';
import { addDocument, deleteDocument, fileToText, listDocuments, urlToText } from '#/lib/lab/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

export const GET = handle(listDocuments);

export const POST = handle(async (req: Request) => {
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Attach a file.');
    if (file.size > MAX_BYTES) throw new Error('Files are limited to 4 MB.');
    if (!/\.(txt|md|markdown|csv|json|pdf|py|ts|html)$/i.test(file.name)) throw new Error('Supported: .txt .md .csv .json .pdf .py .ts .html');
    const text = await fileToText(file.name, new Uint8Array(await file.arrayBuffer()));
    return addDocument(String(form.get('title') || file.name), `file:${file.name}`, text);
  }
  const b = await req.json();
  if (b.url) {
    const url = str(b.url, 'URL', 2000);
    const page = await urlToText(url);
    return addDocument(b.title?.trim() || page.title, url, page.text);
  }
  return addDocument(str(b.title, 'Title', 200), 'text', str(b.text, 'Text', 500_000));
});

export const DELETE = handle(async (req: Request) => {
  await deleteDocument(Number(new URL(req.url).searchParams.get('id')));
});
