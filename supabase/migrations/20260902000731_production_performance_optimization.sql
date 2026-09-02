-- Production performance pass.
--
-- This migration deliberately leaves table grants, policy roles, commands and
-- predicates unchanged. It only turns per-row auth helper calls into init plans,
-- removes policies whose predicates are strict duplicates/subsets of retained
-- policies, and removes indexes whose ordered key definitions are exact matches.

do $migration$
declare
  policy_row record;
  optimized_using text;
  optimized_check text;
  optimized_count integer := 0;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(qual, '') like '%auth.jwt()%'
        or coalesce(qual, '') like '%is_admin()%'
        or coalesce(with_check, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.jwt()%'
        or coalesce(with_check, '') like '%is_admin()%'
      )
  loop
    optimized_using := policy_row.qual;
    optimized_check := policy_row.with_check;

    -- Preserve auth calls that are already init-plan wrapped. pg_get_expr emits
    -- the first spelling today; the compact spelling keeps this migration safe
    -- if PostgreSQL normalisation changes in another environment.
    if optimized_using is not null then
      optimized_using := replace(optimized_using, '( SELECT auth.uid() AS uid)', '__O2D_AUTH_UID_INIT__');
      optimized_using := replace(optimized_using, '(select auth.uid())', '__O2D_AUTH_UID_INIT__');
      optimized_using := replace(optimized_using, '( SELECT auth.jwt() AS jwt)', '__O2D_AUTH_JWT_INIT__');
      optimized_using := replace(optimized_using, '(select auth.jwt())', '__O2D_AUTH_JWT_INIT__');
      optimized_using := replace(optimized_using, '(select public.is_admin())', '__O2D_ADMIN_INIT__');
      optimized_using := replace(optimized_using, 'public.is_admin()', '__O2D_ADMIN_RAW__');
      optimized_using := replace(optimized_using, 'auth.uid()', '(select auth.uid())');
      optimized_using := replace(optimized_using, 'auth.jwt()', '(select auth.jwt())');
      optimized_using := replace(optimized_using, 'is_admin()', '(select is_admin())');
      optimized_using := replace(optimized_using, '__O2D_AUTH_UID_INIT__', '( SELECT auth.uid() AS uid)');
      optimized_using := replace(optimized_using, '__O2D_AUTH_JWT_INIT__', '( SELECT auth.jwt() AS jwt)');
      optimized_using := replace(optimized_using, '__O2D_ADMIN_INIT__', '(select public.is_admin())');
      optimized_using := replace(optimized_using, '__O2D_ADMIN_RAW__', '(select public.is_admin())');
    end if;

    if optimized_check is not null then
      optimized_check := replace(optimized_check, '( SELECT auth.uid() AS uid)', '__O2D_AUTH_UID_INIT__');
      optimized_check := replace(optimized_check, '(select auth.uid())', '__O2D_AUTH_UID_INIT__');
      optimized_check := replace(optimized_check, '( SELECT auth.jwt() AS jwt)', '__O2D_AUTH_JWT_INIT__');
      optimized_check := replace(optimized_check, '(select auth.jwt())', '__O2D_AUTH_JWT_INIT__');
      optimized_check := replace(optimized_check, '(select public.is_admin())', '__O2D_ADMIN_INIT__');
      optimized_check := replace(optimized_check, 'public.is_admin()', '__O2D_ADMIN_RAW__');
      optimized_check := replace(optimized_check, 'auth.uid()', '(select auth.uid())');
      optimized_check := replace(optimized_check, 'auth.jwt()', '(select auth.jwt())');
      optimized_check := replace(optimized_check, 'is_admin()', '(select is_admin())');
      optimized_check := replace(optimized_check, '__O2D_AUTH_UID_INIT__', '( SELECT auth.uid() AS uid)');
      optimized_check := replace(optimized_check, '__O2D_AUTH_JWT_INIT__', '( SELECT auth.jwt() AS jwt)');
      optimized_check := replace(optimized_check, '__O2D_ADMIN_INIT__', '(select public.is_admin())');
      optimized_check := replace(optimized_check, '__O2D_ADMIN_RAW__', '(select public.is_admin())');
    end if;

    if optimized_using is distinct from policy_row.qual
      or optimized_check is distinct from policy_row.with_check then
      if optimized_using is not null and optimized_check is not null then
        execute format(
          'alter policy %I on %I.%I using (%s) with check (%s)',
          policy_row.policyname,
          policy_row.schemaname,
          policy_row.tablename,
          optimized_using,
          optimized_check
        );
      elsif optimized_using is not null then
        execute format(
          'alter policy %I on %I.%I using (%s)',
          policy_row.policyname,
          policy_row.schemaname,
          policy_row.tablename,
          optimized_using
        );
      elsif optimized_check is not null then
        execute format(
          'alter policy %I on %I.%I with check (%s)',
          policy_row.policyname,
          policy_row.schemaname,
          policy_row.tablename,
          optimized_check
        );
      end if;
      optimized_count := optimized_count + 1;
    end if;
  end loop;

  if optimized_count <> 68 then
    raise exception 'Expected to optimize 68 RLS policies, optimized %', optimized_count;
  end if;
end
$migration$;

-- These permissive policies are exact duplicates or strict subsets of retained
-- permissive policies for the same role and command. Dropping them cannot remove
-- access because every row they admit is still admitted by the retained policy.
drop policy "Admins can manage analytics_snapshots" on public.analytics_snapshots;
drop policy emails_sender_delete on public.emails;
drop policy emails_sender_insert on public.emails;
drop policy emails_sender_select on public.emails;
drop policy emails_sender_update on public.emails;
drop policy "Users can view own tasks" on public.lead_tasks;

-- Keep the constraint-backed unique indexes and the more useful leading-key
-- composite index; remove only exact ordered-key duplicates.
alter table public.admin_preferences
  drop constraint admin_preferences_user_id_key_key;

drop index public.blog_posts_slug_idx;
drop index public.idx_lead_events_lead;
