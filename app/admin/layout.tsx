'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Icon } from '@/components/ui';

interface NavItem { id: string; label: string; icon: string; href: string; }
interface NavSection { label: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Production',
    items: [
      { id: 'dashboard',   label: 'Dashboard',          icon: 'layout-dashboard', href: '/admin/dashboard' },
      { id: 'hanks',       label: 'Hanks Production',   icon: 'factory',          href: '/admin/production/hanks' },
      { id: 'conning',     label: 'Conning Production', icon: 'box',              href: '/admin/production/conning' },
      { id: 'dyeing',      label: 'Dyeing Production',  icon: 'droplets',         href: '/admin/production/dyeing' },
      { id: 'ready-stock', label: 'Ready Stock',         icon: 'warehouse',        href: '/admin/ready-stock' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'stock',    label: 'Stock Inward', icon: 'package-plus',   href: '/admin/stock-inward' },
      { id: 'orders',   label: 'Orders',       icon: 'clipboard-list', href: '/admin/orders' },
      { id: 'dispatch', label: 'Dispatch',     icon: 'truck',          href: '/admin/dispatch' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'finance-clients', label: 'Client Finance', icon: 'wallet',         href: '/admin/finance/clients' },
      { id: 'finance-workers', label: 'Worker Loans',   icon: 'banknote',       href: '/admin/finance/workers' },
      { id: 'advances',        label: 'Advances',       icon: 'indian-rupee',   href: '/admin/advances' },
      { id: 'payroll',         label: 'Payroll',        icon: 'file-bar-chart', href: '/admin/payroll' },
    ],
  },
  {
    label: 'Masters',
    items: [
      { id: 'workers',   label: 'Workers',   icon: 'users',   href: '/admin/masters/workers' },
      { id: 'clients',   label: 'Clients',   icon: 'archive', href: '/admin/masters/clients' },
      { id: 'qualities', label: 'Qualities', icon: 'layers',  href: '/admin/masters/qualities' },
      { id: 'machines',  label: 'Machines',  icon: 'cpu',     href: '/admin/masters/machines' },
      { id: 'shades',    label: 'Shades',    icon: 'palette', href: '/admin/masters/shades' },
      { id: 'items',     label: 'Items',     icon: 'tag',     href: '/admin/masters/items' },
    ],
  },
  {
    label: 'Other',
    items: [
      { id: 'attendance', label: 'Attendance',    icon: 'calendar-check', href: '/admin/attendance' },
      { id: 'reports',    label: 'Reports',       icon: 'bar-chart-3',    href: '/admin/reports' },
      { id: 'recipes',    label: 'Color Recipes', icon: 'flask-conical',  href: '/admin/recipes' },
    ],
  },
];

const ALL_NAV    = NAV_SECTIONS.flatMap(s => s.items);
const BOTTOM_NAV = [ALL_NAV[0], ALL_NAV[1], ALL_NAV[2], ALL_NAV[3], ALL_NAV[12]];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Loading…</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    router.replace('/login');
    return null;
  }

  const activeId = ALL_NAV.find(n => pathname?.startsWith(n.href))?.id ?? 'dashboard';

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const initials = user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {/* Sidebar backdrop (mobile) */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{
              width: 32, height: 32, background: 'var(--accent)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
            }}>
              <Icon name="factory" size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 15, letterSpacing: '0.03em' }}>OM INDUSTRIES</h2>
              <small>ERP System</small>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`nav-item ${activeId === item.id ? 'active' : ''}`}
                >
                  <Icon name={item.icon} size={18} className="nav-icon" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </strong>
              <span style={{ fontSize: 11 }}>Administrator</span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', color: 'rgba(255,255,255,0.55)', justifyContent: 'flex-start', gap: 10 }}
            onClick={handleLogout}
          >
            <Icon name="log-out" size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-btn hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-search">
            <Icon name="search" size={16} color="var(--text-secondary)" />
            <input placeholder="Search anything…" aria-label="Search" />
          </div>
        </div>
        <div className="topbar-right">
          <button className="topbar-btn" aria-label="Notifications">
            <Icon name="bell" size={20} />
          </button>
          <button
            className="topbar-btn"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="log-out" size={20} />
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, cursor: 'default', flexShrink: 0,
          }}>
            {initials}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content" key={pathname}>
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {BOTTOM_NAV.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className={`bottom-nav-item ${activeId === item.id ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
