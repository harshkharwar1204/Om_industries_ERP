/**
 * Auto-scale a recipe's chemical quantities to a real batch weight.
 * Recipe ingredient quantities are interpreted by unit:
 *   '%'    -> percent on weight of yarn (owf): grams = batchKg * 10 * qty
 *   'g/l'  -> grams per litre of liquor:        grams = qty * litres (litres = batchKg * MLR)
 *   'g'/'ml' (or anything else) -> per kg of yarn: amount = qty * batchKg
 */
export interface RecipeIngredient { color_name: string; quantity: number | string; unit?: string | null; }
export interface DyeLine { name: string; unit: string; perKg: number; total: number; display: string; }

export function scaleRecipe(ings: RecipeIngredient[], batchKg: number, mlr = 8): DyeLine[] {
  const kg = Number(batchKg) || 0;
  return (ings || []).map(i => {
    const q = Number(i.quantity) || 0;
    const u = (i.unit || 'g').toLowerCase();
    let amount: number;
    if (u === '%') amount = kg * 10 * q;
    else if (u === 'g/l' || u === 'g/litre') amount = q * kg * mlr;
    else amount = q * kg;
    const total = Math.round(amount * 100) / 100;
    const outUnit = u === 'ml' ? 'ml' : 'g';
    return { name: i.color_name, unit: u, perKg: q, total, display: `${total} ${outUnit}` };
  });
}
