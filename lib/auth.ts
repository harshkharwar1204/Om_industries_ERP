import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// Single source of truth for the signing secret. In production the env var is
// mandatory — no insecure fallback (a known fallback lets anyone forge admin tokens).
// The dev-only fallback keeps local dev + scripts/*.mjs working without a secret set.
const FALLBACK_SECRET = 'om-industries-erp-secret-key-2024';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;

export interface JWTPayload {
  id: number;
  name: string;
  phone: string;
  role: string;
  department: string | null;
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.split(' ')[1];
}

export function requireAuth(req: NextRequest): JWTPayload {
  const token = getToken(req);
  if (!token) throw new Error('No token');
  let payload: JWTPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new Error('Invalid token');
  }
  // Customer-portal tokens share the signing secret but are NOT staff tokens.
  // Reject them here so a portal client can't reach staff/requireAuth endpoints.
  if ((payload as any).type === 'portal' || typeof payload.id !== 'number') {
    throw new Error('Invalid token');
  }
  return payload;
}

// Operational admin: full admin + dyeing_master (master sees everything except the
// sensitive areas below, which use requireStrictAdmin).
export function requireAdmin(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (user.role !== 'admin' && user.role !== 'dyeing_master') throw new Error('Admin required');
  return user;
}

// Admin only — for payroll, attendance, worker accounts, finance, settings.
export function requireStrictAdmin(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (user.role !== 'admin') throw new Error('Admin required');
  return user;
}

export function requireRole(req: NextRequest, roles: string[]): JWTPayload {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) throw new Error('Access denied — role required');
  return user;
}

export function requireWorker(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (!['hanks_worker', 'coning_worker'].includes(user.role)) throw new Error('Worker required');
  return user;
}

export function authError(msg: string) {
  const status = msg.includes('required') ? 403 : 401;
  return Response.json({ error: msg }, { status });
}
