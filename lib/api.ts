const BASE = '/api';

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('erp_token') : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> ?? {}) },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('erp_token');
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  const ct = res.headers.get('content-type');
  if (ct?.includes('spreadsheetml') || ct?.includes('octet-stream')) return res.blob();
  return res.json();
}
