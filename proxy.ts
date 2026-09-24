// Optional access gate for the Eval Lab. When LAB_ACCESS_TOKEN is set, the
// lab pages and APIs need a cookie holding that token (set via /lab/login),
// so a public deployment cannot spend the LLM keys. The rest of the site stays public.
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = process.env.LAB_ACCESS_TOKEN;
  if (!token) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === '/lab/login' || pathname === '/api/lab/login') return NextResponse.next();
  if (request.cookies.get('lab_token')?.value === token) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Access token required.' }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = '/lab/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/lab/:path*', '/api/lab/:path*'] };
