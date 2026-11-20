begin;

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
  or public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_company_id()
  )
);

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
  elsif reviewer.roles @> array['super_admin'::public.app_role] then
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

commit;
