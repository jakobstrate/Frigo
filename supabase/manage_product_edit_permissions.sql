begin;

alter table public.profiles
  add column if not exists can_edit_products boolean not null default false;

create or replace function public.current_user_can_edit_products()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
      and role = 'company_admin'
      and can_edit_products
  );
$$;

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all to authenticated
using (
  public.is_super_admin()
  or (
    public.current_user_can_edit_products()
    and (company_id is null or company_id = public.current_company_id())
  )
)
with check (
  public.is_super_admin()
  or (
    public.current_user_can_edit_products()
    and (
      (company_id is null and department_id is null)
      or (company_id = public.current_company_id() and department_id is not null)
    )
  )
);

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all to authenticated
using (
  public.is_super_admin()
  or (
    public.current_user_can_edit_products()
    and company_id is null
  )
)
with check (
  public.is_super_admin()
  or (
    public.current_user_can_edit_products()
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
      public.current_user_can_edit_products()
      and (
        (storage.foldername(name))[1] = 'catalog'
        or (storage.foldername(name))[1] = public.current_company_id()::text
      )
    )
  )
);

drop policy if exists "Company admins manage product images" on storage.objects;
create policy "Company admins manage product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or public.current_user_can_edit_products()
  )
);

commit;
