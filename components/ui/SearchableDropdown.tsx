'use client';
import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

interface Option { label: string; value: string | number; }

interface Props {
  options: (Option | string)[];
  value: string | number | null;
  onChange: (v: string | number) => void;
  placeholder?: string;
}

export function SearchableDropdown({ options, value, onChange, placeholder = 'Select…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const normalize = (o: Option | string): Option =>
    typeof o === 'string' ? { label: o, value: o } : o;

  const filtered = options.map(normalize).filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const selected = options.map(normalize).find(o => String(o.value) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="form-input"
        onClick={() => setOpen(p => !p)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(p => !p); }}
        role="combobox" aria-expanded={open}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--primary-light)' }}>
          {selected?.label || placeholder}
        </span>
        <Icon name="chevron-down" size={16} color="var(--primary-light)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
          zIndex: 60, maxHeight: 240, display: 'flex', flexDirection: 'column',
          animation: 'slideUp 150ms ease',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              className="form-input" placeholder="Search…" value={query} autoFocus
              onChange={e => setQuery(e.target.value)}
              style={{ minHeight: 36, fontSize: 14 }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>No results</div>
            )}
            {filtered.map((o, i) => (
              <div
                key={i}
                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                style={{
                  padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                  background: String(o.value) === String(value) ? 'var(--accent-light)' : 'transparent',
                  fontWeight: String(o.value) === String(value) ? 600 : 400,
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => { if (o.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = o.value === value ? 'var(--accent-light)' : 'transparent'; }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
