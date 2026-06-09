import { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, iconColor = 'var(--accent)', children }: Props) {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
            background: iconColor + '18', color: iconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={20} />
          </div>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && (
            <p className="text-secondary text-sm" style={{ marginTop: 3, fontFamily: 'var(--font-body)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && <div className="flex-row" style={{ flexWrap: 'wrap', gap: 8 }}>{children}</div>}
    </div>
  );
}
