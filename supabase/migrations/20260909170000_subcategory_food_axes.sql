-- Harvest Local — the taxonomy has two levels and the gate was reading one.
--
-- ===========================================================================
-- THE HOLE
-- ===========================================================================
-- `products_guard_food_categories` enforces rule 7: a listing may not be published in a food axis
-- the seller's programme bans. It resolves the axes with
--
--     select food_axes into v_axes from public.categories where id = new.category_id;
--
-- and `category_id` is the TOP-LEVEL category. Every axis recorded on a subcategory has therefore
-- never been consulted by anything.
--
-- That is not a theoretical tidiness point, because the subcategory is where the specific and more
-- restrictive axes live. **Pickles & Ferments** carries `{acidified, fermented}`; its parent
-- **Pantry & Preserves** carries `{shelf_stable}`. The gate saw shelf-stable, asked "does your
-- programme allow shelf-stable food", got yes, and published the jar.
--
-- Thirteen states ban acidified and/or fermented under EVERY programme they run while allowing
-- shelf-stable — CA, CO, CT, DE, HI, LA, MD, MO, NE, NJ, NY, OH and WA. In all of them a pickle
-- listing went live today against a rule the catalogue had correctly written down.
--
-- The same silence hides the opposite case: **Juice & Cider** is deliberately unmapped, and
-- CLAUDE.md explains at length why guessing between acidified, refrigerated and neither would be
-- wrong. That care had no effect either — the parent's `shelf_stable` was answering for it.
--
-- ===========================================================================
-- THE FIX, AND WHY IT IS A UNION
-- ===========================================================================
-- A jar of pickles is shelf-stable AND acidified. Both are true, and a state banning either should
-- block it, so the axes of the category and the subcategory are unioned rather than the narrower
-- one replacing the broader. This is the same shape the label and allergen guards already use for
-- `requires_food_permit` (`bool_or` across category and subcategory) — the taxonomy is read at both
-- levels everywhere else and this was the exception.
--
-- The trigger's column list gains `subcategory_id` too. Without it, a seller could publish under a
-- permitted subcategory and then switch to a banned one without the guard ever re-running.

set search_path = public;

create or replace function public.products_guard_food_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state char(2);
  v_axes text[];
  v_axis text;
begin
  if new.status = 'draft' or new.status = 'archived' then
    return new;
  end if;

  -- Both levels. A subcategory's axes are the specific ones and were previously unreachable.
  select coalesce(array_agg(distinct axis), '{}')
    into v_axes
    from public.categories c,
         unnest(c.food_axes) as axis
   where c.id = new.category_id
      or c.id = new.subcategory_id;

  if v_axes is null or cardinality(v_axes) = 0 then
    return new;
  end if;

  select home_state into v_state from public.seller_profiles where id = new.seller_id;
  if v_state is null then
    return new;
  end if;

  foreach v_axis in array v_axes loop
    if not public.seller_permits_food_axis(new.seller_id, v_axis) then
      raise exception
        '% does not permit selling % under the program you sell on', v_state, replace(v_axis, '_', ' ')
        using errcode = 'check_violation',
              hint = 'Choose a different program in onboarding, or list this under another category.';
    end if;
  end loop;

  return new;
end;
$$;

-- Recreated so the guard also re-runs when only the SUBCATEGORY changes.
drop trigger if exists products_guard_food_categories on public.products;
create trigger products_guard_food_categories
  before insert or update of status, category_id, subcategory_id, seller_id on public.products
  for each row execute function public.products_guard_food_categories();

-- ---------------------------------------------------------------------------
-- Park anything the subcategory axes catch that the parent's never did.
--
-- `draft`, never deleted — the same reasoning as the two backfills before it. The seller keeps the
-- listing and the photographs; what stops is the publication. Written to be correct on a populated
-- database even though this project has no such listing today.
-- ---------------------------------------------------------------------------
update public.products p
   set status = 'draft'
 where p.status in ('active', 'sold_out')
   and exists (
     select 1
       from public.categories c,
            unnest(c.food_axes) as axis
      where (c.id = p.category_id or c.id = p.subcategory_id)
        and not public.seller_permits_food_axis(p.seller_id, axis)
   );

comment on function public.products_guard_food_categories is
  'Rule 7. Resolves food axes from BOTH the category and the subcategory and unions them — a jar of '
  'pickles is shelf-stable and acidified, and a state banning either must block it. Reading only '
  'the top level published acidified goods in 13 states that ban them (see 20260909170000).';
