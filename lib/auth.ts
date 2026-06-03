import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export const JWT_SECRET = process.env.JWT_SECRET || 'om-industries-erp-secret-key-2024';

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
  try {
    return verifyToken(token);
  } catch {
    throw new Error('Invalid token');
  }
}

export function requireAdmin(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (user.role !== 'admin') throw new Error('Admin required');
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
