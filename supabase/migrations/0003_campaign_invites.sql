-- =============================================================================
-- Ember — campaign invites
-- =============================================================================
-- Real campaign/character creation needs a way for a second person to join
-- a campaign, and the existing RLS is deliberately strict about that:
-- memberships_insert_owner_or_dm only lets the campaign's own DM insert a
-- membership row. That's correct — an arbitrary authenticated user should
-- not be able to add themselves to any campaign_id they can guess — but it
-- means there's no self-service join path at all yet.
--
-- The fix is a security definer function, same pattern as is_campaign_member
-- and friends: it runs with the function owner's privileges, so it can look
-- up a campaign by invite code (bypassing the campaigns SELECT policy, which
-- a non-member can't satisfy) and insert the membership row itself, without
-- widening the blanket INSERT policy on memberships for every caller.
-- =============================================================================

alter table public.campaigns add column invite_code text;

-- Backfill for the campaigns created before this column existed.
update public.campaigns
set invite_code = upper(substr(md5(random()::text || id::text), 1, 8))
where invite_code is null;

alter table public.campaigns alter column invite_code set not null;
alter table public.campaigns add constraint campaigns_invite_code_unique unique (invite_code);

create function public.join_campaign_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select id into v_campaign_id
  from public.campaigns
  where invite_code = p_invite_code;

  if v_campaign_id is null then
    raise exception 'Invalid invite code.';
  end if;

  insert into public.memberships (campaign_id, user_id, role)
  values (v_campaign_id, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;

  return v_campaign_id;
end;
$$;

grant execute on function public.join_campaign_by_code(text) to authenticated;
