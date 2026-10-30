create or replace function public.set_department_products(
  p_department_id bigint,
  p_product_ids bigint[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  target_company_id bigint;
begin
  if p_product_ids is null then
    raise exception 'A product selection is required';
  end if;

  select company_id into target_company_id
  from public.departments
  where id = p_department_id;

  if not found then
    raise exception 'The department does not exist or is not accessible';
  end if;

  update public.departments
  set inherits_catalog = false
  where id = p_department_id and company_id = target_company_id;

  if not found then
    raise exception 'The department cannot be updated';
  end if;

  if exists (
    select product_id
    from unnest(p_product_ids) as selected(product_id)
    group by product_id
    having count(*) > 1
  ) then
    raise exception 'A product cannot be selected more than once';
  end if;

  if exists (
    select 1
    from unnest(p_product_ids) as selected(product_id)
    left join public.products p
      on p.id = selected.product_id
      and p.company_id = target_company_id
      and p.active
    left join public.categories c on c.id = p.category_id
    where p.id is null
      or (c.department_id is not null and c.department_id <> p_department_id)
  ) then
    raise exception 'A selected product is unavailable for this department';
  end if;

  delete from public.department_products
  where department_id = p_department_id and company_id = target_company_id;

  insert into public.department_products (company_id, department_id, product_id, is_inherited)
  select target_company_id, p_department_id, selected.product_id, false
  from unnest(p_product_ids) as selected(product_id);
end;
$$;

revoke all on function public.set_department_products(bigint, bigint[]) from public, anon;
grant execute on function public.set_department_products(bigint, bigint[]) to authenticated;
