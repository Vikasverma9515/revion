import { handle, str } from '#/lib/lab/api';
import { getResult, saveAnnotation } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const result = await getResult(Number(b.resultId));
  if (!result) throw new Error('Unknown result.');
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.scores ?? {})) {
    const n = Math.round(Number(v));
    if (n >= 1 && n <= 5) scores[k.slice(0, 60)] = n;
  }
  await saveAnnotation({
    result_id: result.id,
    annotator: str(b.annotator, 'Annotator name', 60),
    pass: !!b.pass,
    scores,
    note: typeof b.note === 'string' ? b.note.slice(0, 2000) : '',
  });
});
