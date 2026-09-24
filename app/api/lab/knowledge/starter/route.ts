import { handle } from '#/lib/lab/api';
import { loadStarterKnowledge } from '#/lib/lab/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = handle(async () => ({ added: await loadStarterKnowledge() }));
