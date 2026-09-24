// Ask an agent a question; the question and the answer are stored in the session.
import { runAgent } from '#/lib/lab/agent';
import { handle, HttpError, str } from '#/lib/lab/api';
import { addMessage, createSession, getAgent, getMessage, getSession, listMessages } from '#/lib/lab/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const question = str(b.question, 'Question', 8000);
  const agent = await getAgent(Number(b.agentId));
  if (!agent) throw new HttpError(404, 'Unknown agent.');
  let sessionId = b.sessionId ? Number(b.sessionId) : 0;
  if (sessionId) {
    const s = await getSession(sessionId);
    if (!s || s.agent_id !== agent.id) throw new HttpError(404, 'Unknown session for this agent.');
  }
  const history = sessionId ? (await listMessages(sessionId)).map((m) => ({ role: m.role, content: m.content })) : [];

  // Run the agent first so a failed call (e.g. a missing key) does not leave a half-written session.
  const a = await runAgent(agent, history, question);
  if (!sessionId) sessionId = await createSession(agent.id, question);
  const userId = await addMessage({ session_id: sessionId, role: 'user', content: question, context: [], trace: [], model: null, latency_ms: null, tokens_in: null, tokens_out: null });
  const assistantId = await addMessage({
    session_id: sessionId, role: 'assistant', content: a.answer, context: a.sources, trace: a.trace,
    model: a.model, latency_ms: a.latencyMs, tokens_in: a.tokensIn, tokens_out: a.tokensOut,
  });
  return { sessionId, user: await getMessage(userId), assistant: await getMessage(assistantId) };
});
