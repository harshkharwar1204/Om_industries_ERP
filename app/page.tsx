'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    router.replace(user.role === 'admin' ? '/admin/dashboard' : '/worker');
  }, [user, loading, router]);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p>
    </div>
  );
}
