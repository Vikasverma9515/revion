import { handle } from '#/lib/lab/api';
import { setupStatus } from '#/lib/lab/config';
import { counts } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(async () => ({ setup: setupStatus(), counts: await counts() }));
