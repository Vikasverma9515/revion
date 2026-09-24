// Acceptance numbers from the brief. The Verify panel runs the same checks.
import { describe, expect, it } from 'vitest';
import { runChecks } from '#/lib/verify';

describe('acceptance', () => {
  for (const c of runChecks()) {
    it(`${c.label}: ${c.actual}`, () => expect(c.pass, `expected ${c.expected}, got ${c.actual}`).toBe(true));
  }
});
