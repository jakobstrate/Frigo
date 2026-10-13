-- Apply after schema.sql on an existing or fresh Supabase project.
-- Employee signup metadata must include display_name and approver_email.

alter table public.profiles
  drop constraint if exists employees_need_a_company;

alter table public.profiles
  add constraint employees_need_a_company check (
    role = 'super_admin'
    or company_id is not null
    or status in ('pending', 'rejected')
  );

alter table public.employee_requests
  alter column company_id drop not null;

alter table public.employee_requests
  add column if not exists requested_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists requested_admin_email text;

alter table public.employee_requests
  drop constraint if exists one_request_per_employee_company;

alter table public.employee_requests
  add constraint one_employee_request unique (employee_id);

drop policy if exists "Employees create employee requests" on public.employee_requests;
drop policy if exists "Admins view employee requests" on public.employee_requests;
drop policy if exists "Admins review employee requests" on public.employee_requests;

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
  assigned_company_id bigint;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  requested_admin_email := lower(trim(coalesce(new.raw_user_meta_data ->> 'approver_email', '')));

  if requested_name is null or requested_admin_email = '' then
    raise exception 'Employee signup requires display_name and approver_email';
  end if;

  select * into target_admin
  from public.profiles p
  where lower(p.email) = requested_admin_email
    and p.status = 'active'
    and p.role in ('company_admin', 'super_admin')
  order by p.created_at
  limit 1;

  if not found then
    raise exception 'No active CompanyAdmin or SuperAdmin matches the entered email';
  end if;

  if target_admin.role = 'company_admin' and target_admin.company_id is null then
    raise exception 'The selected CompanyAdmin is not linked to a company';
  end if;

  assigned_company_id := case
    when target_admin.role = 'company_admin' then target_admin.company_id
    else null
  end;

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

  insert into public.notifications (user_id, title, message)
  values (
    target_admin.id,
    'Employee request',
    requested_name || ' requested access to Frigo.'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_employee_request on auth.users;
create trigger on_auth_user_created_employee_request
after insert on auth.users
for each row execute function public.create_employee_request_for_auth_user();

create or replace function public.review_employee_request(
  p_request_id bigint,
  p_accept boolean,
  p_company_id bigint default null,
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

  if reviewer.role = 'super_admin' then
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
  elsif reviewer.role = 'company_admin'
    and reviewer.company_id = request_row.company_id
    and request_row.requested_admin_id = reviewer.id then
    approved_company_id := reviewer.company_id;
  else
    raise exception 'You are not authorized to review this request';
  end if;

  if p_accept then
    if approved_company_id is null then
      raise exception 'An active company is required to accept this request';
    end if;
    update public.profiles
    set company_id = approved_company_id, status = 'active'
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

revoke all on function public.review_employee_request(bigint, boolean, bigint, text) from public;
grant execute on function public.review_employee_request(bigint, boolean, bigint, text) to authenticated;