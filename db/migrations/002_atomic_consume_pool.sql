-- Migration 002 — atomic FIFO pool consumption
-- Removes the read-then-write race in lib/transfer.consumePool: two concurrent
-- approvals could both read the same remaining_kg and over-consume a pool.
-- This function locks the candidate rows (FOR UPDATE) and decrements atomically.
-- Apply in Supabase SQL editor. Once present, the app calls it automatically;
-- until then it falls back to the (non-atomic) JS path.

create or replace function public.consume_pool(
  p_table   text,
  p_client  bigint,
  p_quality bigint,
  p_kg      numeric
) returns numeric
language plpgsql
as $$
declare
  r          record;
  remaining  numeric := p_kg;
  consumed   numeric := 0;
  take       numeric;
  newrem     numeric;
begin
  if p_table not in ('grey_stock', 'dyed_stock') then
    raise exception 'invalid pool table: %', p_table;
  end if;

  for r in execute format(
      'select id, remaining_kg from %I '
      'where remaining_kg > 0 and client_id = $1 '
      'and ($2 is null or quality_id = $2) '
      'order by date asc for update', p_table)
    using p_client, p_quality
  loop
    exit when remaining <= 0;
    take   := least(r.remaining_kg, remaining);
    newrem := r.remaining_kg - take;
    if p_table = 'dyed_stock' then
      execute format(
        'update %I set remaining_kg = $1, '
        'status = case when $1 <= 0 then ''coned'' else status end where id = $2', p_table)
        using newrem, r.id;
    else
      execute format('update %I set remaining_kg = $1 where id = $2', p_table)
        using newrem, r.id;
    end if;
    remaining := remaining - take;
    consumed  := consumed + take;
  end loop;

  return consumed;
end;
$$;
