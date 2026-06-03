import { Icon } from './Icon';

interface Props {
  icon: string;
  label: string;
  value: string | number;
  trend?: string;
  trendDir?: 'up' | 'down';
  color?: string;
}

export function StatCard({ icon, label, value, trend, trendDir, color = 'var(--info)' }: Props) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: color + '18', color }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {trend && (
          <div className="stat-trend" style={{ color: trendDir === 'up' ? 'var(--success)' : 'var(--danger)' }}>
            <Icon name={trendDir === 'up' ? 'trending-up' : 'trending-down'} size={13} />
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
