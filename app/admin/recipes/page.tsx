'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface Ingredient { color: string; quantity: string; unit: string; }
interface Shade { name: string; ingredients: Ingredient[]; }
interface Recipe { id?: number; code: string; client: string; notes: string; shades: Shade[]; }

const BLANK: Recipe = {
  code: '', client: '', notes: '',
  shades: [{ name: 'Shade 1', ingredients: [{ color: '', quantity: '', unit: 'g' }] }],
};

export default function RecipesPage() {
  const [recipes, setRecipes]   = useState<any[]>([]);
  const [colors, setColors]     = useState<any[]>([]);
  const [editing, setEditing]   = useState<Recipe>(BLANK);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/recipes'), apiFetch('/colors')])
      .then(([r, c]) => { setRecipes(r); setColors(c); })
      .catch(e => toast(e.message, 'error'));
  }, []);

  const reload = () => apiFetch('/recipes').then(setRecipes).catch(e => toast(e.message, 'error'));

  const save = async () => {
    if (!editing.code || !editing.client) { toast('Code and client required', 'error'); return; }
    setSaving(true);
    try {
      if ((editing as any).id) await apiFetch(`/recipes/${(editing as any).id}`, { method: 'PUT', body: JSON.stringify(editing) });
      else                     await apiFetch('/recipes', { method: 'POST', body: JSON.stringify(editing) });
      toast('Recipe saved'); setEditing(BLANK); reload();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this recipe?')) return;
    try { await apiFetch(`/recipes/${id}`, { method: 'DELETE' }); toast('Deleted'); reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const setShades = (fn: (s: Shade[]) => Shade[]) => setEditing(p => ({ ...p, shades: fn(p.shades) }));
  const setIngredients = (si: number, fn: (ing: Ingredient[]) => Ingredient[]) =>
    setShades(s => s.map((sh, i) => i === si ? { ...sh, ingredients: fn(sh.ingredients) } : sh));

  const filtered = recipes.filter(r =>
    (r.code?.toLowerCase().includes(search.toLowerCase())) ||
    (r.client?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-enter recipes-split" style={{ display: 'flex', gap: 20, height: 'calc(100vh - 112px)', overflow: 'hidden' }}>

      {/* Left: recipe log */}
      <div className="card recipes-list" style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Saved Recipes <span className="badge badge-info" style={{ marginLeft: 6 }}>{recipes.length}</span></h3>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, fontSize: 14, minHeight: 38 }} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {filtered.map(r => (
            <div
              key={r.id}
              style={{
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${(editing as any).id === r.id ? 'var(--accent)' : 'var(--border)'}`,
                background: (editing as any).id === r.id ? 'var(--accent-light)' : 'var(--surface)',
                cursor: 'pointer', marginBottom: 6,
                transition: 'all 150ms ease',
              }}
              onClick={() => setEditing({ id: r.id, code: r.code, client: r.client, notes: r.notes || '', shades: (r.shades ?? []).map((s: any) => ({ name: s.name, ingredients: (s.ingredients ?? []).map((i: any) => ({ color: i.color_name, quantity: String(i.quantity), unit: i.unit })) })) })}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.code}</div>
              <div className="text-secondary text-sm" style={{ marginTop: 2 }}>{r.client} · {r.shades?.length ?? 0} shade{r.shades?.length !== 1 ? 's' : ''}</div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 6, color: 'var(--danger)', padding: '2px 6px', minHeight: 26, fontSize: 12 }}
                onClick={e => { e.stopPropagation(); del(r.id); }}
              >
                <Icon name="trash-2" size={13} /> Delete
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <Icon name="flask-conical" size={36} color="var(--primary-light)" />
              <p style={{ fontSize: 13, marginTop: 8 }}>No recipes found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: editor */}
      <div className="card recipes-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <PageHeader title={(editing as any).id ? 'Edit Recipe' : 'New Recipe'}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(BLANK)}>Clear</button>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ gap: 8 }}>
              {saving ? 'Saving…' : <><Icon name="check" size={15} /> Save Recipe</>}
            </button>
          </PageHeader>
          <div className="form-row" style={{ marginTop: -8 }}>
            <div className="form-group">
              <label className="form-label">Recipe Code *</label>
              <input className="form-input" value={editing.code} onChange={e => setEditing(p => ({ ...p, code: e.target.value }))} placeholder="e.g. RCP-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Client *</label>
              <input className="form-input" value={editing.client} onChange={e => setEditing(p => ({ ...p, client: e.target.value }))} placeholder="Party name" />
            </div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {editing.shades.map((shade, si) => (
            <div key={si} className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                  <input
                    className="form-input" value={shade.name} style={{ fontWeight: 600, flex: 1 }}
                    onChange={e => setShades(s => s.map((sh, i) => i === si ? { ...sh, name: e.target.value } : sh))}
                    placeholder="Shade name"
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setShades(s => s.filter((_, i) => i !== si))}
                    disabled={editing.shades.length <= 1}
                  >Remove</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span style={{ flex: 2, minWidth: 0 }}>Chemical / Color</span>
                  <span style={{ width: 80 }}>Qty</span>
                  <span style={{ width: 70 }}>Unit</span>
                  <span style={{ width: 32 }}></span>
                </div>

                {shade.ingredients.map((ing, ii) => (
                  <div key={ii} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-select" style={{ flex: 2, minWidth: 0, fontSize: 14, minHeight: 40 }} value={ing.color}
                      onChange={e => setIngredients(si, ings => ings.map((g, j) => j === ii ? { ...g, color: e.target.value } : g))}>
                      <option value="">Select color…</option>
                      {colors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input className="form-input" type="number" style={{ width: 80, fontSize: 14, minHeight: 40 }} value={ing.quantity} placeholder="Qty"
                      onChange={e => setIngredients(si, ings => ings.map((g, j) => j === ii ? { ...g, quantity: e.target.value } : g))} />
                    <select className="form-select" style={{ width: 70, fontSize: 14, minHeight: 40 }} value={ing.unit}
                      onChange={e => setIngredients(si, ings => ings.map((g, j) => j === ii ? { ...g, unit: e.target.value } : g))}>
                      <option>g</option><option>ml</option><option>%</option><option>g/L</option>
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: 32, height: 40, padding: 0, color: 'var(--danger)' }}
                      onClick={() => setIngredients(si, ings => ings.filter((_, j) => j !== ii))}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}

                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--info)', marginTop: 4 }}
                  onClick={() => setIngredients(si, ings => [...ings, { color: '', quantity: '', unit: 'g' }])}
                >
                  <Icon name="plus" size={14} /> Add Chemical
                </button>
              </div>
            </div>
          ))}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: 8, borderStyle: 'dashed' }}
            onClick={() => setShades(s => [...s, { name: `Shade ${s.length + 1}`, ingredients: [{ color: '', quantity: '', unit: 'g' }] }])}
          >
            <Icon name="plus" size={15} /> Add Shade
          </button>
        </div>
      </div>
    </div>
  );
}
