import Link from 'next/link';
import { Icon } from './Icon';

interface Props {
  icon: string;
  label: string;
  value: string | number;
  trend?: string;
  trendDir?: 'up' | 'down';
  color?: string;
  href?: string;
}

export function StatCard({ icon, label, value, trend, trendDir, color = 'var(--info)', href }: Props) {
  const trendColor = trendDir === 'up' ? 'var(--success)' : trendDir === 'down' ? 'var(--danger)' : 'var(--text-secondary)';

  const inner = (
    <div className={`card stat-card${href ? ' stat-card-link' : ''}`}>
      <div className="stat-icon" style={{ background: color + '18', color }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {trend && (
          <div className="stat-trend" style={{ color: trendColor }}>
            {trendDir && <Icon name={trendDir === 'up' ? 'trending-up' : 'trending-down'} size={13} />}
            {trend}
          </div>
        )}
      </div>
      {href && (
        <div style={{ alignSelf: 'flex-start', color: 'var(--primary-light)', flexShrink: 0, marginTop: 2 }}>
          <Icon name="chevron-right" size={16} />
        </div>
      )}
    </div>
  );

  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  return inner;
}
