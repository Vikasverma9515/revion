import { config } from '#/lib/lab/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: '' }));
  if (!config.accessToken || token !== config.accessToken) {
    return Response.json({ error: 'Wrong access token.' }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', `lab_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`);
  return res;
}
