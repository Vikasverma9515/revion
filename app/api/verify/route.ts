// Runs every acceptance check and streams each badge as it completes.
import { runChecks } from '#/lib/verify';
import { sseResponse, tick } from '#/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET() {
  return sseResponse(async (send) => {
    await tick();
    for (const check of runChecks()) {
      send('check', check);
      await tick();
    }
  });
}
