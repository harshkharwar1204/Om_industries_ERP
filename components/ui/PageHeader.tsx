import { ReactNode } from 'react';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && (
          <p className="text-secondary text-sm" style={{ marginTop: 3, fontFamily: 'var(--font-body)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex-row" style={{ flexWrap: 'wrap', gap: 8 }}>{children}</div>}
    </div>
  );
}
