create or replace function public.update_company_details(
  p_company_id bigint,
  p_company_name text,
  p_departments jsonb,
  p_admin_id uuid,
  p_admin_name text,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  department jsonb;
  department_id bigint;
  department_name text;
  kept_department_ids bigint[] := array[]::bigint[];
begin
  if p_company_id is null
    or nullif(trim(p_company_name), '') is null
    or nullif(trim(p_admin_name), '') is null
    or nullif(trim(p_admin_email), '') is null
    or p_admin_id is null
    or jsonb_typeof(p_departments) is distinct from 'array' then
    raise exception 'Company, department, and administrator details are required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_departments) as rows(value)
    group by lower(trim(value ->> 'name'))
    having lower(trim(value ->> 'name')) = '' or count(*) > 1
  ) then
    raise exception 'Department names must be non-empty and unique';
  end if;

  if not exists (
    select 1 from public.companies
    where id = p_company_id and status <> 'deleted'
  ) then
    raise exception 'The company does not exist or has been deleted';
  end if;

  if exists (select 1 from public.profiles where id = p_admin_id) then
    if not exists (
      select 1 from public.profiles
      where id = p_admin_id
        and company_id = p_company_id
        and role = 'company_admin'
        and status = 'active'
    ) then
      raise exception 'Select an active administrator belonging to this company';
    end if;
  end if;

  for department in select value from jsonb_array_elements(p_departments)
  loop
    if jsonb_typeof(department) <> 'object' then
      raise exception 'Invalid department details';
    end if;

    department_name := nullif(trim(department ->> 'name'), '');
    if department_name is null then
      raise exception 'Department names cannot be empty';
    end if;

    if nullif(department ->> 'id', '') is not null then
      department_id := (department ->> 'id')::bigint;
      if department_id = any(kept_department_ids) then
        raise exception 'A department was submitted more than once';
      end if;
      if not exists (
        select 1 from public.departments
        where id = department_id and company_id = p_company_id
      ) then
        raise exception 'A department does not belong to this company';
      end if;
      kept_department_ids := array_append(kept_department_ids, department_id);
    end if;
  end loop;

  update public.companies
  set name = trim(p_company_name)
  where id = p_company_id;

  delete from public.departments
  where company_id = p_company_id
    and not (id = any(kept_department_ids));

  update public.departments
  set name = '__frigo_edit_' || id::text
  where company_id = p_company_id
    and id = any(kept_department_ids);

  for department in select value from jsonb_array_elements(p_departments)
  loop
    department_name := trim(department ->> 'name');
    if nullif(department ->> 'id', '') is null then
      insert into public.departments (company_id, name)
      values (p_company_id, department_name);
    else
      department_id := (department ->> 'id')::bigint;
      update public.departments
      set name = department_name
      where id = department_id and company_id = p_company_id;
    end if;
  end loop;

  insert into public.profiles (id, display_name, email, role, status, company_id)
  values (p_admin_id, trim(p_admin_name), lower(trim(p_admin_email)), 'company_admin', 'active', p_company_id)
  on conflict (id) do update
  set display_name = excluded.display_name,
      email = excluded.email
  where profiles.company_id = p_company_id
    and profiles.role = 'company_admin'
    and profiles.status = 'active';

  if not found then
    raise exception 'Select an active administrator belonging to this company';
  end if;
end;
$$;

revoke all on function public.update_company_details(bigint, text, jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_company_details(bigint, text, jsonb, uuid, text, text) to service_role;