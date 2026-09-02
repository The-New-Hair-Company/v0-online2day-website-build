-- Consolidate overlapping permissive policies without changing their effective
-- predicates. PostgreSQL ORs permissive policies for a role/action; these new
-- command-specific policies contain that same OR once, avoiding repeated policy
-- evaluation for every row.

do $migration$
declare
  target record;
  existing_policy record;
  select_using text;
  insert_check text;
  update_using text;
  update_check text;
  delete_using text;
  consolidated_tables integer := 0;
begin
  for target in
    select *
    from (values
      ('public', 'async_action_failures'),
      ('public', 'contact_imports'),
      ('public', 'conversations'),
      ('public', 'emails'),
      ('public', 'lead_agreements'),
      ('public', 'lead_assets'),
      ('public', 'lead_events'),
      ('public', 'lead_tasks'),
      ('public', 'leads'),
      ('public', 'licensed_users'),
      ('public', 'notifications'),
      ('public', 'site_build_requests'),
      ('public', 'site_requests'),
      ('public', 'trial_accounts'),
      ('public', 'user_profiles'),
      ('public', 'videos'),
      ('storage', 'objects')
    ) as targets(schema_name, table_name)
  loop
    select string_agg(format('(%s)', coalesce(qual, 'true')), ' OR ' order by policyname)
      into select_using
    from pg_policies
    where schemaname = target.schema_name
      and tablename = target.table_name
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and cmd in ('ALL', 'SELECT');

    select string_agg(format('(%s)', coalesce(with_check, qual, 'true')), ' OR ' order by policyname)
      into insert_check
    from pg_policies
    where schemaname = target.schema_name
      and tablename = target.table_name
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and cmd in ('ALL', 'INSERT');

    select
      string_agg(format('(%s)', coalesce(qual, 'true')), ' OR ' order by policyname),
      string_agg(format('(%s)', coalesce(with_check, qual, 'true')), ' OR ' order by policyname)
      into update_using, update_check
    from pg_policies
    where schemaname = target.schema_name
      and tablename = target.table_name
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and cmd in ('ALL', 'UPDATE');

    select string_agg(format('(%s)', coalesce(qual, 'true')), ' OR ' order by policyname)
      into delete_using
    from pg_policies
    where schemaname = target.schema_name
      and tablename = target.table_name
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and cmd in ('ALL', 'DELETE');

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = target.schema_name
        and tablename = target.table_name
        and permissive = 'PERMISSIVE'
        and roles = array['authenticated']::name[]
    loop
      execute format(
        'drop policy %I on %I.%I',
        existing_policy.policyname,
        target.schema_name,
        target.table_name
      );
    end loop;

    if select_using is not null then
      execute format(
        'create policy o2d_authenticated_select on %I.%I for select to authenticated using (%s)',
        target.schema_name,
        target.table_name,
        select_using
      );
    end if;

    if insert_check is not null then
      execute format(
        'create policy o2d_authenticated_insert on %I.%I for insert to authenticated with check (%s)',
        target.schema_name,
        target.table_name,
        insert_check
      );
    end if;

    if update_using is not null then
      execute format(
        'create policy o2d_authenticated_update on %I.%I for update to authenticated using (%s) with check (%s)',
        target.schema_name,
        target.table_name,
        update_using,
        update_check
      );
    end if;

    if delete_using is not null then
      execute format(
        'create policy o2d_authenticated_delete on %I.%I for delete to authenticated using (%s)',
        target.schema_name,
        target.table_name,
        delete_using
      );
    end if;

    consolidated_tables := consolidated_tables + 1;
  end loop;

  if consolidated_tables <> 17 then
    raise exception 'Expected to consolidate 17 tables, consolidated %', consolidated_tables;
  end if;
end
$migration$;

-- The published-post policy previously targeted PUBLIC, which made it overlap
-- the admin policy for authenticated users. Only anon/authenticated have table
-- grants (service_role and postgres bypass RLS), so splitting the read predicate
-- by those roles preserves access while removing the overlap.
drop policy "Admins manage blog posts" on public.blog_posts;
drop policy "Public read published posts" on public.blog_posts;

create policy "Public read published posts"
  on public.blog_posts
  for select
  to anon
  using (published = true and (published_at is null or published_at <= now()));

create policy o2d_authenticated_select
  on public.blog_posts
  for select
  to authenticated
  using (
    (published = true and (published_at is null or published_at <= now()))
    or (select public.is_admin())
  );

create policy o2d_authenticated_insert
  on public.blog_posts
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy o2d_authenticated_update
  on public.blog_posts
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy o2d_authenticated_delete
  on public.blog_posts
  for delete
  to authenticated
  using ((select public.is_admin()));
