-- Apply after schema.sql on an existing or fresh Supabase project.
-- Employee signup metadata must include display_name and company_id.

alter table public.profiles
  add column if not exists department_id bigint,
  add column if not exists avatar_path text,
  add column if not exists invitation_completed boolean not null default true,
  add column if not exists roles public.app_role[] not null default array['employee'::public.app_role];

update public.profiles
set roles = array[role]
where not (roles @> array[role]);

update public.profiles
set roles = roles || array['employee'::public.app_role]
where role = 'company_admin'
  and company_id is not null
  and not (roles @> array['employee'::public.app_role]);

update public.profiles
set roles = roles
  || case
    when roles @> array['company_admin'::public.app_role] then array[]::public.app_role[]
    else array['company_admin'::public.app_role]
  end
  || case
    when roles @> array['employee'::public.app_role] then array[]::public.app_role[]
    else array['employee'::public.app_role]
  end
where role = 'super_admin'
  and company_id is not null
  and (
    not (roles @> array['company_admin'::public.app_role])
    or not (roles @> array['employee'::public.app_role])
  );

drop policy if exists "Employees create employee requests" on public.employee_requests;
create policy "Employees create employee requests"
on public.employee_requests for insert to authenticated
with check (
  employee_id = auth.uid()
  and company_id = public.current_company_id()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and roles @> array['employee'::public.app_role]
  )
);

alter table public.profiles
  drop constraint if exists employees_need_a_company;

alter table public.profiles
  drop constraint if exists profiles_primary_role_assigned;
alter table public.profiles
  add constraint profiles_primary_role_assigned check (
    cardinality(roles) > 0
    and role = case
      when roles @> array['super_admin'::public.app_role] then 'super_admin'::public.app_role
      when roles @> array['company_admin'::public.app_role] then 'company_admin'::public.app_role
      else 'employee'::public.app_role
    end
  );

alter table public.profiles
  add constraint employees_need_a_company check (
    (role = 'super_admin' or company_id is not null)
    and (not (roles @> array['company_admin'::public.app_role]) or company_id is not null)
    and (
      not (roles @> array['employee'::public.app_role])
      or company_id is not null
      or status in ('pending', 'rejected')
    )
  );

drop policy if exists "Users create their employee profile" on public.profiles;
create policy "Users create their employee profile"
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and role = 'employee'
  and roles = array['employee'::public.app_role]
  and status = 'pending'
);

drop policy if exists "Company admins create employees" on public.profiles;
create policy "Company admins create employees"
on public.profiles for insert to authenticated
with check (
  public.current_user_role() = 'company_admin'
  and role = 'employee'
  and roles = array['employee'::public.app_role]
  and company_id = public.current_company_id()
);

alter table public.profiles
  drop constraint if exists profiles_department_company_fkey;

alter table public.profiles
  add constraint profiles_department_company_fkey
  foreign key (department_id, company_id) references public.departments(id, company_id)
  on delete set null (department_id);

drop policy if exists "Anyone can view active companies for signup" on public.companies;
create policy "Anyone can view active companies for signup"
on public.companies for select to anon, authenticated
using (status = 'active');

alter table public.employee_requests
  alter column company_id drop not null;

alter table public.employee_requests
  add column if not exists requested_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists requested_admin_email text;

create table if not exists public.account_deletion_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id bigint not null references public.companies(id) on delete cascade,
  requested_admin_id uuid references public.profiles(id) on delete set null,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_company_status_idx
on public.account_deletion_requests(company_id, status);
create unique index if not exists account_deletion_requests_one_pending_per_user_idx
on public.account_deletion_requests(user_id)
where status = 'pending';
alter table public.account_deletion_requests enable row level security;
drop trigger if exists account_deletion_requests_set_updated_at on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

alter table public.employee_requests
  drop constraint if exists one_request_per_employee_company;

alter table public.employee_requests
  drop constraint if exists one_employee_request;

alter table public.employee_requests
  add constraint one_employee_request unique (employee_id);

drop policy if exists "Employees create employee requests" on public.employee_requests;
drop policy if exists "Admins view employee requests" on public.employee_requests;
drop policy if exists "Admins review employee requests" on public.employee_requests;
drop policy if exists "Employees and assigned admins view employee requests" on public.employee_requests;

create policy "Employees and assigned admins view employee requests"
on public.employee_requests for select to authenticated
using (
  employee_id = auth.uid()
  or requested_admin_id = auth.uid()
  or public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_company_id()
  )
);

drop policy if exists "Users and assigned admins view account deletion requests" on public.account_deletion_requests;
create policy "Users and assigned admins view account deletion requests"
on public.account_deletion_requests for select to authenticated
using (
  user_id = auth.uid()
  or requested_admin_id = auth.uid()
  or (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_company_id()
  )
);

create or replace function public.request_account_deletion()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  requester public.profiles%rowtype;
  target_admin public.profiles%rowtype;
  request_id bigint;
begin
  select * into requester
  from public.profiles
  where id = auth.uid()
    and status = 'active'
    and roles @> array['employee'::public.app_role]
    and company_id is not null;

  if not found then
    raise exception 'An active company account is required to request account deletion';
  end if;

  select * into target_admin
  from public.profiles
  where company_id = requester.company_id
    and roles @> array['company_admin'::public.app_role]
    and status = 'active'
  order by created_at
  limit 1;

  if not found then
    select * into target_admin
    from public.profiles
    where role = 'super_admin'
      and status = 'active'
    order by created_at
    limit 1;
  end if;

  if target_admin.id is null then
    raise exception 'No active company administrator or Superadmin can review this request';
  end if;

  insert into public.account_deletion_requests (user_id, company_id, requested_admin_id)
  values (requester.id, requester.company_id, target_admin.id)
  returning id into request_id;

  insert into public.notifications (user_id, title, message)
  select admin.id, 'Account deletion request', requester.display_name || ' requested account deletion.'
  from public.profiles admin
  where admin.company_id = requester.company_id
    and admin.roles @> array['company_admin'::public.app_role]
    and admin.status = 'active';

  if not found then
    insert into public.notifications (user_id, title, message)
    values (target_admin.id, 'Account deletion request', requester.display_name || ' requested account deletion.');
  end if;

  return request_id;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.review_account_deletion_request(
  p_request_id bigint,
  p_reviewer_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.account_deletion_requests%rowtype;
  reviewer public.profiles%rowtype;
begin
  select * into reviewer
  from public.profiles
  where id = p_reviewer_id
    and status = 'active'
    and (
      roles @> array['company_admin'::public.app_role]
      or roles @> array['super_admin'::public.app_role]
    );

  if not found then
    raise exception 'An active admin account is required';
  end if;

  select * into request_row
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if not found or request_row.status <> 'pending' then
    raise exception 'This account deletion request is no longer pending';
  end if;

  if reviewer.roles @> array['company_admin'::public.app_role]
    and reviewer.company_id = request_row.company_id then
    null;
  elsif reviewer.roles @> array['super_admin'::public.app_role]
    and request_row.requested_admin_id = reviewer.id then
    null;
  else
    raise exception 'You are not authorized to review this request';
  end if;

  if p_accept then
    update public.profiles
    set status = 'deleted'
    where id = request_row.user_id
      and status = 'active';

    if not found then
      raise exception 'The requested account is no longer active';
    end if;
  end if;

  update public.account_deletion_requests
  set status = case when p_accept then 'accepted'::public.request_status else 'declined'::public.request_status end,
      reviewed_by = reviewer.id,
      reviewed_at = now()
  where id = request_row.id;
end;
$$;

revoke all on function public.review_account_deletion_request(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_account_deletion_request(bigint, uuid, boolean) to service_role;

create or replace function public.current_company_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.status = 'active'
    and (p.company_id is null or c.status = 'active');
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and status = 'active';
$$;

create or replace function public.current_department_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select department_id
  from public.profiles
  where id = auth.uid() and status = 'active';
$$;

create or replace function public.create_employee_request_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_admin public.profiles%rowtype;
  requested_name text;
  requested_admin_email text;
  requested_company_id bigint;
  assigned_company_id bigint;
begin
  if new.raw_user_meta_data ->> 'frigo_invitation_role' in ('company_admin', 'admin_created')
    or new.raw_user_meta_data ->> 'frigo_admin_created' = 'true' then
    return new;
  end if;

  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if nullif(trim(new.raw_user_meta_data ->> 'company_id'), '') is not null then
    begin
      requested_company_id := (new.raw_user_meta_data ->> 'company_id')::bigint;
    exception when invalid_text_representation then
      raise exception 'Select an existing company';
    end;

    if not exists (
      select 1 from public.companies
      where id = requested_company_id and status = 'active'
    ) then
      raise exception 'The selected company does not exist or is inactive';
    end if;

    select * into target_admin
    from public.profiles p
    where p.company_id = requested_company_id
      and p.roles @> array['company_admin'::public.app_role]
      and p.status = 'active'
    order by p.created_at
    limit 1;

    if not found then
      select * into target_admin
      from public.profiles p
      where p.role = 'super_admin' and p.status = 'active'
      order by p.created_at
      limit 1;
    end if;

    assigned_company_id := requested_company_id;
  else
  requested_admin_email := lower(trim(coalesce(new.raw_user_meta_data ->> 'approver_email', '')));

    if requested_admin_email = '' then
      raise exception 'Employee signup requires a company selection';
    end if;

    select * into target_admin
    from public.profiles p
    where lower(p.email) = requested_admin_email
      and p.status = 'active'
      and p.role in ('company_admin', 'super_admin')
    order by p.created_at
    limit 1;

    if target_admin.id is null then
      raise exception 'No active CompanyAdmin or SuperAdmin matches the entered email';
    end if;

    if target_admin.roles @> array['company_admin'::public.app_role]
      and target_admin.company_id is null then
      raise exception 'The selected CompanyAdmin is not linked to a company';
    end if;

    assigned_company_id := case
      when target_admin.roles @> array['company_admin'::public.app_role] then target_admin.company_id
      else null
    end;
  end if;

  if requested_name is null or target_admin.id is null then
    raise exception 'Employee signup requires a name, active company admin, or superadmin';
  end if;

  requested_admin_email := target_admin.email;
  insert into public.profiles (id, display_name, email, role, status, company_id)
  values (new.id, requested_name, new.email, 'employee', 'pending', assigned_company_id);

  insert into public.employee_requests (
    employee_id,
    company_id,
    requested_admin_id,
    requested_admin_email,
    status
  ) values (
    new.id,
    assigned_company_id,
    target_admin.id,
    requested_admin_email,
    'pending'
  );

  if target_admin.roles @> array['company_admin'::public.app_role] then
    insert into public.notifications (user_id, title, message)
    select p.id, 'Employee request', requested_name || ' requested access to Frigo.'
    from public.profiles p
    where p.company_id = assigned_company_id
      and p.roles @> array['company_admin'::public.app_role]
      and p.status = 'active';
  else
    insert into public.notifications (user_id, title, message)
    values (target_admin.id, 'Employee request', requested_name || ' requested access to Frigo.');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_employee_request on auth.users;
create trigger on_auth_user_created_employee_request
after insert on auth.users
for each row execute function public.create_employee_request_for_auth_user();

drop function if exists public.review_employee_request(bigint, boolean, bigint, text);

drop function if exists public.create_company_with_admin(text, text[], uuid, text, text);
drop function if exists public.create_company_without_admin(text, text[]);

create or replace function public.create_company_without_admin(
  p_company_name text,
  p_department_names text[],
  p_admin_id uuid default null,
  p_admin_name text default null,
  p_admin_email text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  created_company_id bigint;
begin
  if nullif(trim(p_company_name), '') is null then
    raise exception 'A company name is required';
  end if;

  if (p_admin_id is null) <> (nullif(trim(p_admin_name), '') is null)
    or (p_admin_id is null) <> (nullif(trim(p_admin_email), '') is null) then
    raise exception 'Administrator ID, name, and email must all be provided together';
  end if;

  insert into public.companies (name)
  values (trim(p_company_name))
  returning id into created_company_id;

  insert into public.departments (company_id, name)
  select created_company_id, department.name
  from (
    select distinct on (lower(trim(candidate.name))) trim(candidate.name) as name
    from unnest(coalesce(p_department_names, array[]::text[])) as candidate(name)
    where nullif(trim(candidate.name), '') is not null
    order by lower(trim(candidate.name)), trim(candidate.name)
  ) as department;

  if p_admin_id is not null then
    insert into public.profiles (id, display_name, email, role, roles, status, company_id, invitation_completed)
    values (
      p_admin_id,
      trim(p_admin_name),
      lower(trim(p_admin_email)),
      'company_admin',
      array['company_admin'::public.app_role, 'employee'::public.app_role],
      'inactive',
      created_company_id,
      false
    );
  end if;

  return created_company_id;
end;
$$;

revoke all on function public.create_company_without_admin(text, text[], uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_company_without_admin(text, text[], uuid, text, text) to service_role;

create or replace function public.activate_invited_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_profile public.profiles%rowtype;
  password_is_set boolean;
  has_active_company_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in through the invitation link to activate this account';
  end if;

  select * into invited_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if not found or invited_profile.invitation_completed or invited_profile.status <> 'inactive' then
    raise exception 'There is no pending invitation for this account';
  end if;

  select coalesce(nullif(u.encrypted_password, ''), '') <> ''
  into password_is_set
  from auth.users u
  where u.id = auth.uid();

  if not coalesce(password_is_set, false) then
    raise exception 'Create a password before activating this account';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.company_id = invited_profile.company_id
      and p.roles @> array['company_admin'::public.app_role]
      and p.status = 'active'
      and p.id <> invited_profile.id
  ) into has_active_company_admin;

  update public.profiles
  set status = 'active',
      invitation_completed = true
  where id = invited_profile.id;

  if invited_profile.roles @> array['company_admin'::public.app_role]
    and invited_profile.company_id is not null
    and not has_active_company_admin then
    update public.employee_requests
    set requested_admin_id = invited_profile.id,
        requested_admin_email = invited_profile.email
    where company_id = invited_profile.company_id
      and status = 'pending';

    update public.account_deletion_requests
    set requested_admin_id = invited_profile.id
    where company_id = invited_profile.company_id
      and status = 'pending';
  end if;
end;
$$;

revoke all on function public.activate_invited_account() from public, anon;
grant execute on function public.activate_invited_account() to authenticated;

create or replace function public.prevent_last_company_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  replacement_required boolean := false;
begin
  if exists (select 1 from public.companies where id = old.company_id and status = 'deleted') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.roles @> array['company_admin'::public.app_role]
    and old.status = 'active'
    and new.roles @> array['company_admin'::public.app_role]
    and new.status = 'inactive'
    and new.company_id = old.company_id
    and not new.invitation_completed
    and exists (
      select 1
      from auth.users u
      where u.id = old.id
        and u.invited_at is not null
        and coalesce(u.encrypted_password, '') = ''
    ) then
    return new;
  end if;

  if old.roles @> array['company_admin'::public.app_role] and old.status = 'active' then
    if tg_op = 'DELETE' then
      replacement_required := true;
    else
      replacement_required := not (new.roles @> array['company_admin'::public.app_role])
        or new.status <> 'active'
        or new.company_id <> old.company_id;
    end if;
  end if;

  if replacement_required and not exists (
    select 1 from public.profiles replacement
    where replacement.company_id = old.company_id
      and replacement.roles @> array['company_admin'::public.app_role]
      and replacement.status = 'active'
      and replacement.id <> old.id
  ) then
    raise exception 'Select a replacement company admin before deleting this user';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

update public.profiles p
set status = 'inactive',
    invitation_completed = false
from auth.users u
where p.id = u.id
  and p.status = 'active'
  and p.invitation_completed
  and u.invited_at is not null
  and coalesce(u.encrypted_password, '') = '';

create or replace function public.prevent_company_admin_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    if new.role <> old.role or new.roles is distinct from old.roles or new.company_id <> old.company_id then
      raise exception 'Only a super admin can change roles or company assignments';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_company_admin_delete on public.profiles;
create trigger prevent_last_company_admin_delete
before delete or update of role, roles, status, company_id on public.profiles
for each row execute function public.prevent_last_company_admin_delete();

drop trigger if exists prevent_company_admin_role_escalation on public.profiles;
create trigger prevent_company_admin_role_escalation
before update on public.profiles
for each row execute function public.prevent_company_admin_role_escalation();

create or replace function public.soft_delete_company(p_company_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.companies set status = 'deleted' where id = p_company_id and status <> 'deleted';
  if not found then
    raise exception 'The company does not exist or has already been deleted';
  end if;
  update public.profiles set status = 'deleted' where company_id = p_company_id and status <> 'deleted';
end;
$$;

revoke all on function public.soft_delete_company(bigint) from public, anon, authenticated;
grant execute on function public.soft_delete_company(bigint) to service_role;

create or replace function public.prevent_early_hard_delete()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'profiles' then
    if not exists (
      select 1 from public.purchases where purchaser_id = old.id
    ) and not exists (
      select 1 from public.payments where user_id = old.id
    ) and not exists (
      select 1 from public.payment_provider_accounts where user_id = old.id
    ) then
      return old;
    end if;
  end if;

  if old.deleted_at is null or old.deleted_at > now() - interval '5 years' then
    raise exception 'Record must be soft-deleted for at least five years before permanent deletion';
  end if;
  return old;
end;
$$;

create or replace function public.review_employee_request(
  p_request_id bigint,
  p_accept boolean,
  p_company_id bigint default null,
  p_department_id bigint default null,
  p_decline_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.employee_requests%rowtype;
  reviewer public.profiles%rowtype;
  approved_company_id bigint;
begin
  select * into reviewer from public.profiles where id = auth.uid();
  if not found or reviewer.status <> 'active' then
    raise exception 'An active admin account is required';
  end if;

  select * into request_row
  from public.employee_requests
  where id = p_request_id
  for update;

  if not found or request_row.status <> 'pending' then
    raise exception 'This employee request is no longer pending';
  end if;

  if reviewer.roles @> array['company_admin'::public.app_role]
    and reviewer.company_id = request_row.company_id then
    approved_company_id := reviewer.company_id;
  elsif reviewer.roles @> array['super_admin'::public.app_role] then
    if request_row.requested_admin_id is distinct from reviewer.id then
      raise exception 'Only the SuperAdmin assigned to this request can review it';
    end if;
    if p_accept then
      if p_company_id is null or not exists (
        select 1 from public.companies c where c.id = p_company_id and c.status = 'active'
      ) then
        raise exception 'Select an active company before accepting this request';
      end if;
      approved_company_id := p_company_id;
    end if;
  else
    raise exception 'You are not authorized to review this request';
  end if;

  if p_accept then
    if approved_company_id is null then
      raise exception 'An active company is required to accept this request';
    end if;
    if p_department_id is not null and not exists (
      select 1 from public.departments
      where id = p_department_id and company_id = approved_company_id
    ) then
      raise exception 'Select a department that belongs to the selected company';
    end if;
    update public.profiles
    set company_id = approved_company_id, department_id = p_department_id, status = 'active'
    where id = request_row.employee_id;

    update public.employee_requests
    set company_id = approved_company_id,
        status = 'accepted',
        reviewed_by = reviewer.id,
        reviewed_at = now()
    where id = request_row.id;
  else
    update public.profiles set status = 'rejected' where id = request_row.employee_id;
    update public.employee_requests
    set status = 'declined',
        decline_reason = nullif(trim(p_decline_reason), ''),
        reviewed_by = reviewer.id,
        reviewed_at = now()
    where id = request_row.id;

    insert into public.notifications (user_id, title, message)
    values (
      request_row.employee_id,
      'Employee request declined',
      coalesce(nullif(trim(p_decline_reason), ''), 'Your employee request was declined.')
    );
  end if;
end;
$$;

revoke all on function public.review_employee_request(bigint, boolean, bigint, bigint, text) from public;
grant execute on function public.review_employee_request(bigint, boolean, bigint, bigint, text) to authenticated;

drop policy if exists "Company members view products" on public.products;
create policy "Company members view products"
on public.products for select to authenticated
using (
  public.is_super_admin()
  or (
    (company_id is null or company_id = public.current_company_id())
    and (active or public.current_user_role() = 'company_admin')
    and (
      public.current_user_role() = 'company_admin'
      or
      public.current_department_id() is null
      or exists (
        select 1
        from public.department_products dp
        where dp.company_id = public.current_company_id()
          and dp.department_id = public.current_department_id()
          and dp.product_id = products.id
      )
    )
  )
);

alter table public.purchases
  alter column department_id drop not null;

alter table public.purchases
  drop constraint if exists purchases_department_id_product_id_company_id_fkey;

alter table public.purchases
  drop constraint if exists purchases_department_id_company_id_fkey;

-- Historical purchases retain their department, but must not block later catalog changes.
alter table public.purchases
  add constraint purchases_department_id_company_id_fkey
  foreign key (department_id, company_id)
  references public.departments(id, company_id) on delete restrict;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchases'::regclass
      and conname = 'purchases_product_id_fkey'
  ) then
    alter table public.purchases
      add constraint purchases_product_id_fkey
      foreign key (product_id) references public.products(id) on delete restrict;
  end if;
end;
$$;

drop policy if exists "Company members create purchases" on public.purchases;
create policy "Company members create purchases"
on public.purchases for insert to authenticated
with check (
  (company_id = public.current_company_id() or public.is_super_admin())
  and purchaser_id = auth.uid()
  and (
    (department_id is null and public.current_department_id() is null)
    or department_id = public.current_department_id()
  )
  and exists (
    select 1
    from public.products p
    where p.id = purchases.product_id and p.active
  )
);

create or replace function public.prevent_inactive_product_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_is_active boolean;
begin
  -- Serialize purchase insertion with concurrent product deactivation.
  select p.active into product_is_active
  from public.products p
  where p.id = new.product_id
  for share;

  if not found or product_is_active is not true then
    raise exception 'Produktet er ikke længere aktivt. Opdater produktlisten, og prøv igen.';
  end if;

  if new.department_id is not null then
    perform 1
    from public.department_products dp
    where dp.department_id = new.department_id
      and dp.product_id = new.product_id
      and dp.company_id = new.company_id
    for share;

    if not found then
      raise exception 'Produktet er ikke længere tilgængeligt for din afdeling.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists purchases_require_active_product on public.purchases;
create trigger purchases_require_active_product
before insert on public.purchases
for each row execute function public.prevent_inactive_product_purchase();

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', false)
on conflict (id) do update
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Admins upload profile images" on storage.objects;
create policy "Admins upload profile images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and (
    public.is_super_admin()
    or (
      public.current_user_role() = 'company_admin'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);

drop policy if exists "Company members view profile images" on storage.objects;
create policy "Company members view profile images"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-images'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.current_company_id()::text
  )
);

drop policy if exists "Admins delete profile images" on storage.objects;
create policy "Admins delete profile images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and (
    public.is_super_admin()
    or (
      public.current_user_role() = 'company_admin'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);

do $$
declare
  catalog_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Supabase Realtime publication does not exist';
  end if;

  foreach catalog_table in array array['products', 'categories', 'department_products', 'profiles']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = catalog_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', catalog_table);
    end if;
  end loop;
end;
$$;