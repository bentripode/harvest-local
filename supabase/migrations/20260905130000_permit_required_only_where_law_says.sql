-- Harvest Local — ask for a cottage food permit only where the verified law says one exists.
--
-- `seller_has_required_documents` demanded ['id', 'tax_id', 'cottage_food'] from every food seller
-- in every state. Verifying Texas against Tex. Health & Safety Code ch. 437 showed what that costs:
-- Texas issues no cottage food permit at all, and §437.0192(a) forbids a local authority from even
-- requiring one. A Texas seller could therefore never satisfy our gate honestly — the only way
-- through was to upload something that isn't the thing we asked for.
--
-- That is the same failure as the seeded $50,000 revenue cap: a guardrail firing on a fact nobody
-- checked. So the permit is now required only where a VERIFIED row says a licence or registration
-- is needed:
--
--   * the seller's chosen program (`state_food_programs.license_required`), when that program has
--     been verified by an admin; else
--   * the state row (`state_cottage_food_rules.requires_license`), when THAT has been verified.
--
-- 'conditional' counts as required. It means "needed in some circumstances", and the seller is the
-- one who knows which circumstance they are in — asking for the document and letting an admin see
-- it is the safe side of an ambiguous answer. 'unclear' does not count: it is missing data.
--
-- Unverified rows require nothing. That is a deliberate loosening and it is the honest default:
-- all 51 state rows shipped with `requires_license = false` as a placeholder, so gating on them
-- enforced nothing real anyway, while the unconditional demand above blocked lawful sellers. The ID
-- and tax ID remain required of everyone, everywhere, unconditionally — those are ours to ask for,
-- not the state's.
--
-- As each state is verified this tightens on its own, with no code change.

set search_path = public;

create or replace function public.seller_requires_food_permit(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with seller as (
    select sp.home_state, sp.food_program_id
      from public.seller_profiles sp
     where sp.id = p_seller_id
  ),
  -- The chosen program wins when it has actually been reviewed by a person.
  program as (
    select fp.license_required
      from public.state_food_programs fp
      join seller s on s.food_program_id = fp.id
     where fp.verified_at is not null
  ),
  -- Otherwise the state row, again only once verified.
  state_rule as (
    select r.requires_license
      from public.state_cottage_food_rules r
      join seller s on s.home_state = r.state_code
     where r.verified_at is not null
  )
  select case
    when not public.seller_sells_cottage_food(p_seller_id) then false
    when exists (select 1 from program)
      then (select license_required in ('yes', 'conditional') from program)
    when exists (select 1 from state_rule)
      then (select coalesce(requires_license, false) from state_rule)
    else false
  end;
$$;

comment on function public.seller_requires_food_permit(uuid) is
  'Whether this seller must produce a cottage food permit: only when a VERIFIED program or state '
  'row says a licence or registration is required. Unverified law requires nothing, because the '
  'seeded rows are placeholders. conditional counts as required; unclear does not.';

create or replace function public.seller_has_required_documents(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(
      case
        when public.seller_requires_food_permit(p_seller_id)
          then array['id', 'tax_id', 'cottage_food']
        else array['id', 'tax_id']
      end
    ) as required(license_type)
    where not exists (
      select 1
      from public.seller_licenses l
      where l.seller_id = p_seller_id
        and l.license_type = required.license_type
        and l.verification_status = 'verified'
        and (l.expiration_date is null or l.expiration_date >= current_date)
    )
  );
$$;

comment on function public.seller_has_required_documents(uuid) is
  'Every required document verified and unexpired. Government ID and tax ID always; a cottage food '
  'permit only where verified law says one is required (seller_requires_food_permit).';

revoke all on function public.seller_requires_food_permit(uuid) from public, anon, authenticated;
grant execute on function public.seller_requires_food_permit(uuid) to service_role;

-- A seller previously paused for a permit their state does not issue should come back up.
do $$
declare
  r record;
begin
  for r in
    select id from public.seller_profiles
     where is_paused and pause_reason in ('license_unverified', 'license_expired')
  loop
    perform public.sync_seller_license_pause(r.id);
  end loop;
end;
$$;
