import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase
      .from('recipes')
      .select('*, shades(*, ingredients(*))')
      .eq('id', params.id).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { code, client, notes, shades } = await req.json();

    // Update recipe
    const { error: rErr } = await supabase
      .from('recipes').update({ code, client, notes }).eq('id', params.id);
    if (rErr) throw rErr;

    // Delete old shades (cascades to ingredients via FK)
    const { data: oldShades } = await supabase.from('shades').select('id').eq('recipe_id', params.id);
    if (oldShades?.length) {
      const ids = oldShades.map((s: any) => s.id);
      await supabase.from('ingredients').delete().in('shade_id', ids);
      await supabase.from('shades').delete().eq('recipe_id', params.id);
    }

    // Re-insert shades + ingredients
    if (Array.isArray(shades)) {
      for (const shade of shades) {
        const { data: shadeRow, error: sErr } = await supabase
          .from('shades').insert([{ recipe_id: Number(params.id), name: shade.name }]).select().single();
        if (sErr) throw sErr;
        const ingredients = (shade.ingredients ?? [])
          .filter((i: any) => i.color && i.quantity)
          .map((i: any) => ({ shade_id: shadeRow.id, color_name: i.color, quantity: Number(i.quantity), unit: i.unit || 'g' }));
        if (ingredients.length > 0) {
          await supabase.from('ingredients').insert(ingredients);
        }
      }
    }

    return NextResponse.json({ message: 'Updated' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { data: shades } = await supabase.from('shades').select('id').eq('recipe_id', params.id);
    if (shades?.length) {
      await supabase.from('ingredients').delete().in('shade_id', shades.map((s: any) => s.id));
      await supabase.from('shades').delete().eq('recipe_id', params.id);
    }
    const { error } = await supabase.from('recipes').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
