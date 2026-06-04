'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Icon } from '@/components/ui';

const NAV = [
  { href: '/worker',            icon: 'home',            label: 'Entry' },
  { href: '/worker/history',    icon: 'clipboard-list',  label: 'History' },
  { href: '/worker/advances',   icon: 'indian-rupee',    label: 'Advance' },
  { href: '/worker/attendance', icon: 'calendar-check',  label: 'Attend' },
  { href: '/worker/payslip',    icon: 'file-text',       label: 'Payslip' },
];

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Loading…</p>
      </div>
    );
  }

  if (!user || !['hanks_worker', 'coning_worker', 'dyeing_master'].includes(user.role)) {
    router.replace('/login');
    return null;
  }

  const handleLogout = () => { logout(); router.replace('/login'); };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100dvh', background: 'var(--bg)',
      paddingBottom: 72,
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        padding: '0 20px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="factory" size={17} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            OM ERP
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            aria-label="Logout"
            title="Sign out"
          >
            <Icon name="log-out" size={20} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, padding: 16, maxWidth: 560, margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 50,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
      }}>
        {NAV.map(n => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '10px 0', textDecoration: 'none', minHeight: 56,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: active ? 600 : 400,
                fontFamily: 'var(--font-body)',
                transition: 'color 150ms',
              }}
            >
              <Icon name={n.icon} size={22} style={{ transform: active ? 'translateY(-2px)' : 'none', transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)' }} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
