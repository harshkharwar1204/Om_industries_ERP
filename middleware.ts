import { NextRequest, NextResponse } from 'next/server';

// Routes that create sessions or use a different token type — skip session check.
const EXEMPT_PREFIXES = ['/api/auth/', '/api/portal/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (EXEMPT_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.next();

  const token = auth.slice(7);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) return NextResponse.next();

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/sessions?token=eq.${encodeURIComponent(token)}&select=id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'Session revoked. Please log in again.' },
          { status: 401 }
        );
      }
    }
  } catch {
    // If session check fails (network/DB issue), let the request through.
    // The route's requireAuth will still validate the JWT signature.
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
