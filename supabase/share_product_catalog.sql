begin;

alter table public.categories
  alter column company_id drop not null;

alter table public.products
  add column if not exists unit text not null default '',
  alter column company_id drop not null;

alter table public.products
  drop constraint if exists products_category_id_company_id_fkey;
alter table public.department_products
  drop constraint if exists department_products_product_id_company_id_fkey;
alter table public.favorites
  drop constraint if exists favorites_product_id_company_id_fkey;
alter table public.products
  drop constraint if exists products_category_id_fkey;
alter table public.department_products
  drop constraint if exists department_products_product_id_fkey;
alter table public.favorites
  drop constraint if exists favorites_product_id_fkey;

insert into public.categories (company_id, department_id, name, active)
select null, null, department_categories.name, bool_or(department_categories.active)
from public.categories as department_categories
where department_categories.department_id is not null
  and not exists (
    select 1
    from public.categories as shared_category
    where shared_category.company_id is null
      and shared_category.department_id is null
      and shared_category.name = department_categories.name
  )
group by department_categories.name;

update public.products as product
set category_id = (
  select min(shared_category.id)
  from public.categories as department_category
  join public.categories as shared_category
    on shared_category.company_id is null
    and shared_category.department_id is null
    and shared_category.name = department_category.name
  where department_category.id = product.category_id
    and department_category.department_id is not null
)
where exists (
  select 1
  from public.categories as department_category
  where department_category.id = product.category_id
    and department_category.department_id is not null
);

update public.products as product
set category_id = (
  select min(shared_category.id)
  from public.categories as existing_category
  join public.categories as shared_category
    on shared_category.department_id is null
    and shared_category.name = existing_category.name
  where existing_category.id = product.category_id
    and existing_category.department_id is null
)
where exists (
  select 1
  from public.categories as existing_category
  where existing_category.id = product.category_id
    and existing_category.department_id is null
);

with shared_category_status as (
  select name, bool_or(active) as active
  from public.categories
  where department_id is null
  group by name
)
update public.categories as category
set active = shared_category_status.active
from shared_category_status
where category.name = shared_category_status.name
  and category.department_id is null
  and category.id = (
    select min(canonical.id)
    from public.categories as canonical
    where canonical.name = category.name
      and canonical.department_id is null
  );

delete from public.categories as duplicate
where duplicate.department_id is null
  and duplicate.id <> (
    select min(canonical.id)
    from public.categories as canonical
    where canonical.name = duplicate.name
      and canonical.department_id is null
  );

update public.categories
set company_id = null
where department_id is null;

create unique index if not exists categories_global_name_unique
on public.categories(name)
where company_id is null and department_id is null;

update public.products
set company_id = null;

alter table public.categories
  drop constraint if exists categories_global_scope_check;
alter table public.categories
  add constraint categories_global_scope_check
  check (
    (company_id is null and department_id is null)
    or (company_id is not null and department_id is not null)
  );
alter table public.products
  drop constraint if exists products_global_catalog_check;
alter table public.products
  add constraint products_global_catalog_check
  check (company_id is null);

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete set null;
alter table public.department_products
  add constraint department_products_product_id_fkey
  foreign key (product_id) references public.products(id) on delete cascade;
alter table public.favorites
  add constraint favorites_product_id_fkey
  foreign key (product_id) references public.products(id) on delete cascade;

insert into public.department_products (company_id, department_id, product_id, is_inherited)
select department.company_id, department.id, product.id, true
from public.departments as department
cross join public.products as product
left join public.categories as category on category.id = product.category_id
where department.inherits_catalog
  and product.active
  and (category.department_id is null or category.department_id = department.id)
on conflict (department_id, product_id) do nothing;

create or replace function public.sync_department_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'departments' then
    if new.inherits_catalog then
      insert into public.department_products (company_id, department_id, product_id, is_inherited)
      select new.company_id, new.id, product.id, true
      from public.products as product
      left join public.categories as category on category.id = product.category_id
      where (product.company_id is null or product.company_id = new.company_id)
        and product.active
        and (category.department_id is null or category.department_id = new.id)
      on conflict (department_id, product_id) do nothing;
    elsif tg_op = 'UPDATE' and old.inherits_catalog then
      delete from public.department_products
      where department_id = new.id and is_inherited;
    end if;
  elsif tg_table_name = 'products' and new.active then
    insert into public.department_products (company_id, department_id, product_id, is_inherited)
    select department.company_id, department.id, new.id, true
    from public.departments as department
    left join public.categories as category on category.id = new.category_id
    where (new.company_id is null or department.company_id = new.company_id)
      and department.inherits_catalog
      and (category.department_id is null or category.department_id = department.id)
    on conflict (department_id, product_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_inheriting_departments on public.products;
create trigger products_sync_inheriting_departments
after insert or update of active on public.products
for each row execute function public.sync_department_catalog();

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
    left join public.products as product
      on product.id = selected.product_id
      and (product.company_id is null or product.company_id = target_company_id)
      and product.active
    left join public.categories as category on category.id = product.category_id
    where product.id is null
      or (category.department_id is not null and category.department_id <> p_department_id)
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

drop policy if exists "Company members view catalog" on public.categories;
create policy "Company members view catalog"
on public.categories for select to authenticated
using (
  public.is_super_admin()
  or (
    company_id is null
    and (active or public.current_user_role() = 'company_admin')
  )
  or (
    company_id = public.current_company_id()
    and (active or public.current_user_role() = 'company_admin')
  )
);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all to authenticated
using (
  public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and (company_id is null or company_id = public.current_company_id())
  )
)
with check (
  public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and (
      (company_id is null and department_id is null)
      or (company_id = public.current_company_id() and department_id is not null)
    )
  )
);

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
      or public.current_department_id() is null
      or exists (
        select 1
        from public.department_products as membership
        where membership.company_id = public.current_company_id()
          and membership.department_id = public.current_department_id()
          and membership.product_id = products.id
      )
    )
  )
);

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all to authenticated
using (
  public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and company_id is null
  )
)
with check (
  public.is_super_admin()
  or (
    public.current_user_role() = 'company_admin'
    and company_id is null
  )
);

drop policy if exists "Company admins upload product images" on storage.objects;
create policy "Company admins upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or (
      public.current_user_role() = 'company_admin'
      and (
        (storage.foldername(name))[1] = 'catalog'
        or (storage.foldername(name))[1] = public.current_company_id()::text
      )
    )
  )
);

drop policy if exists "Company members view product images" on storage.objects;
create policy "Company members view product images"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (public.is_super_admin() or public.current_company_id() is not null)
);

drop policy if exists "Company admins manage product images" on storage.objects;
create policy "Company admins manage product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or public.current_user_role() = 'company_admin'
  )
);

commit;
