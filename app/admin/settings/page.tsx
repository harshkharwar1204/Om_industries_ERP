'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

const FIELDS: { key: string; label: string }[] = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'owner_name', label: 'Owner Name' },
  { key: 'challan_header_blessing', label: 'Challan Blessing Line' },
  { key: 'factory_address_line1', label: 'Factory Address — Line 1' },
  { key: 'factory_address_line2', label: 'Factory Address — Line 2' },
  { key: 'factory_phone', label: 'Phone' },
  { key: 'factory_gstin', label: 'Factory GSTIN' },
];

export default function SettingsPage() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { apiFetch('/settings').then(setVals).catch(e => toast(e.message, 'error')); }, []);

  const save = async () => {
    setSaving(true);
    try { await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(vals) }); toast('Settings saved ✓'); }
    catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-enter">
      <PageHeader title="Settings" subtitle="Company & delivery challan header" icon="settings" iconColor="var(--primary)">
        <button className="btn btn-primary" onClick={save} disabled={saving}><Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}</button>
      </PageHeader>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FIELDS.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-input" value={vals[f.key] ?? ''} onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <p className="text-secondary text-sm" style={{ marginTop: 14 }}>These appear on the A5 delivery challan header.</p>
        </div>
      </div>
    </div>
  );
}
