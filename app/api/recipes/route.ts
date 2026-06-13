import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ['admin', 'dyeing_master']);
    const { data, error } = await supabase
      .from('recipes')
      .select('*, shades(id, name, ingredients(id, color_name, quantity, unit, quantity_liters))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((r: any) => ({ ...r, shades: r.shades ?? [] }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { code, client, notes, shades } = await req.json();
    if (!code || !client) return NextResponse.json({ error: 'Code and client required' }, { status: 400 });

    // Insert recipe
    const { data: recipe, error: rErr } = await supabase
      .from('recipes').insert([{ code: code.trim(), client: client.trim(), notes: notes || null }])
      .select().single();
    if (rErr) throw rErr;

    // Insert shades + ingredients
    if (Array.isArray(shades)) {
      for (const shade of shades) {
        const { data: shadeRow, error: sErr } = await supabase
          .from('shades').insert([{ recipe_id: recipe.id, name: shade.name }]).select().single();
        if (sErr) throw sErr;
        if (Array.isArray(shade.ingredients) && shade.ingredients.length > 0) {
          const ingredients = shade.ingredients
            .filter((i: any) => i.color && i.quantity)
            .map((i: any) => ({ shade_id: shadeRow.id, color_name: i.color, quantity: Number(i.quantity), quantity_liters: Number(i.quantity), unit: i.unit || 'g' }));
          if (ingredients.length > 0) {
            const { error: iErr } = await supabase.from('ingredients').insert(ingredients);
            if (iErr) throw iErr;
          }
        }
      }
    }

    return NextResponse.json({ ...recipe, shades: shades ?? [] }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
