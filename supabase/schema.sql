-- Frigo database schema
-- Run this in Supabase Dashboard > SQL Editor on a new project.
-- Create Auth users first; profiles are linked to auth.users.

create type public.app_role as enum ('super_admin', 'company_admin', 'employee');
create type public.user_status as enum ('pending', 'active', 'rejected', 'inactive', 'deleted');
create type public.request_status as enum ('pending', 'accepted', 'declined');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_type as enum ('purchase', 'salary_withdrawal');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null unique,
  inherited_from_company_id bigint references public.companies(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  role public.app_role not null default 'employee',
  status public.user_status not null default 'pending',
  company_id bigint references public.companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, company_id),
  constraint employees_need_a_company check (
    role = 'super_admin' or company_id is not null
  )
);

create table public.employee_requests (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  company_id bigint not null references public.companies(id) on delete cascade,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_request_per_employee_company unique (employee_id, company_id)
);

create table public.departments (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  name text not null,
  inherits_catalog boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, name)
);

create table public.categories (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  department_id bigint,
  name text not null,
  copied_from_category_id bigint references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  unique (id, company_id),
  foreign key (department_id, company_id) references public.departments(id, company_id) on delete cascade
);

create unique index categories_company_name_unique
on public.categories(company_id, name)
where department_id is null;

create unique index categories_department_name_unique
on public.categories(company_id, department_id, name)
where department_id is not null;

create table public.products (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  category_id bigint,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  image_path text not null,
  copied_from_product_id bigint references public.products(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (category_id, company_id) references public.categories(id, company_id)
);

-- Department-product membership is the single source of truth for which departments offer a product.
create table public.department_products (
  company_id bigint not null references public.companies(id) on delete cascade,
  department_id bigint not null,
  product_id bigint not null,
  is_inherited boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (department_id, product_id),
  unique (department_id, product_id, company_id),
  foreign key (department_id, company_id) references public.departments(id, company_id) on delete cascade,
  foreign key (product_id, company_id) references public.products(id, company_id) on delete cascade
);

create table public.favorites (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  product_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id),
  foreign key (user_id, company_id) references public.profiles(id, company_id) on delete cascade,
  foreign key (product_id, company_id) references public.products(id, company_id) on delete cascade
);

create table public.payment_provider_accounts (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete restrict,
  user_id uuid not null,
  provider text not null default 'zenergy',
  external_account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_id),
  unique (provider, user_id),
  foreign key (user_id, company_id) references public.profiles(id, company_id) on delete restrict
);

create table public.purchases (
  id bigint generated always as identity primary key,
  purchaser_id uuid not null references public.profiles(id) on delete restrict,
  company_id bigint not null references public.companies(id) on delete restrict,
  department_id bigint not null,
  product_id bigint not null,
  purchaser_name text not null,
  department_name text not null,
  product_name text not null,
  amount integer not null check (amount > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) generated always as (amount * unit_price) stored,
  created_at timestamptz not null default now(),
  foreign key (department_id, product_id, company_id)
    references public.department_products(department_id, product_id, company_id) on delete restrict
);

create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  company_id bigint not null references public.companies(id) on delete restrict,
  purchase_id bigint references public.purchases(id) on delete set null,
  payment_type public.payment_type not null default 'purchase',
  amount numeric(12, 2) not null check (amount >= 0),
  status public.payment_status not null default 'paid',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_history (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  company_id bigint references public.companies(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_company_idx on public.profiles(company_id);
create index employee_requests_company_status_idx on public.employee_requests(company_id, status);
create index products_company_category_idx on public.products(company_id, category_id);
create index department_products_company_idx on public.department_products(company_id, department_id, product_id);
create index favorites_user_idx on public.favorites(user_id, created_at desc);
create index purchases_company_created_idx on public.purchases(company_id, created_at desc);
create index payments_company_paid_idx on public.payments(company_id, paid_at desc);
create index audit_history_company_created_idx on public.audit_history(company_id, created_at desc);

create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger departments_set_updated_at before update on public.departments
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger employee_requests_set_updated_at before update on public.employee_requests
for each row execute function public.set_updated_at();
create trigger department_products_set_updated_at before update on public.department_products
for each row execute function public.set_updated_at();
create trigger favorites_set_updated_at before update on public.favorites
for each row execute function public.set_updated_at();
create trigger payment_provider_accounts_set_updated_at before update on public.payment_provider_accounts
for each row execute function public.set_updated_at();

create or replace function public.sync_department_catalog()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'departments' then
    if new.inherits_catalog then
      insert into public.department_products (company_id, department_id, product_id, is_inherited)
      select new.company_id, new.id, p.id, true
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.company_id = new.company_id
        and p.active
        and (c.department_id is null or c.department_id = new.id)
      on conflict (department_id, product_id) do nothing;
    elsif tg_op = 'UPDATE' and old.inherits_catalog then
      delete from public.department_products
      where department_id = new.id and is_inherited;
    end if;
  elsif tg_table_name = 'products' and new.active then
    insert into public.department_products (company_id, department_id, product_id, is_inherited)
    select new.company_id, d.id, new.id, true
    from public.departments d
    left join public.categories c on c.id = new.category_id
    where d.company_id = new.company_id
      and d.inherits_catalog
      and (c.department_id is null or c.department_id = d.id)
    on conflict (department_id, product_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger departments_sync_catalog_insert
after insert on public.departments
for each row execute function public.sync_department_catalog();

create trigger departments_sync_catalog_update
after update of inherits_catalog on public.departments
for each row when (old.inherits_catalog is distinct from new.inherits_catalog)
execute function public.sync_department_catalog();

create trigger products_sync_inheriting_departments
after insert on public.products
for each row execute function public.sync_department_catalog();

create or replace function public.validate_product_department_category()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'department_products' then
    if exists (
      select 1
      from public.products p
      join public.categories c on c.id = p.category_id
      where p.id = new.product_id
        and c.department_id is not null
        and c.department_id <> new.department_id
    ) then
      raise exception 'A department-specific category can only be used by products in that department';
    end if;
  elsif tg_table_name = 'products' and new.category_id is not null then
    if exists (
      select 1
      from public.department_products dp
      join public.categories c on c.id = new.category_id
      where dp.product_id = new.id
        and c.department_id is not null
        and c.department_id <> dp.department_id
    ) then
      raise exception 'The selected department-specific category conflicts with an assigned department';
    end if;
  end if;
  return new;
end;
$$;

create trigger department_products_validate_category
before insert or update of department_id, product_id on public.department_products
for each row execute function public.validate_product_department_category();

create trigger products_validate_department_category
before update of category_id on public.products
for each row execute function public.validate_product_department_category();

create or replace function public.set_soft_delete_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'profiles' and new.status = 'deleted' and old.status is distinct from 'deleted' then
    new.deleted_at = now();
  elsif tg_table_name = 'companies' and new.status = 'deleted' and old.status is distinct from 'deleted' then
    new.deleted_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.prevent_early_hard_delete()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is null or old.deleted_at > now() - interval '5 years' then
    raise exception 'Record must be soft-deleted for at least five years before permanent deletion';
  end if;
  return old;
end;
$$;

create trigger profiles_set_deleted_at
before update of status on public.profiles
for each row execute function public.set_soft_delete_timestamps();

create trigger companies_set_deleted_at
before update of status on public.companies
for each row execute function public.set_soft_delete_timestamps();

create trigger profiles_prevent_early_hard_delete
before delete on public.profiles
for each row execute function public.prevent_early_hard_delete();

create trigger companies_prevent_early_hard_delete
before delete on public.companies
for each row execute function public.prevent_early_hard_delete();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_company_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

create or replace function public.prevent_last_company_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  replacement_required boolean := false;
begin
  if old.role = 'company_admin' and old.status = 'active' then
    if tg_op = 'DELETE' then
      replacement_required := true;
    else
      replacement_required := new.role <> 'company_admin'
        or new.status <> 'active'
        or new.company_id <> old.company_id;
    end if;
  end if;

  if replacement_required and not exists (
       select 1 from public.profiles replacement
       where replacement.company_id = old.company_id
         and replacement.role = 'company_admin'
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

create or replace function public.prevent_company_admin_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    if new.role <> old.role or new.company_id <> old.company_id then
      raise exception 'Only a super admin can change roles or company assignments';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_last_company_admin_delete
before delete or update of role, status, company_id on public.profiles
for each row execute function public.prevent_last_company_admin_delete();

create trigger prevent_company_admin_role_escalation
before update on public.profiles
for each row execute function public.prevent_company_admin_role_escalation();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.employee_requests enable row level security;
alter table public.departments enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.department_products enable row level security;
alter table public.favorites enable row level security;
alter table public.payment_provider_accounts enable row level security;
alter table public.purchases enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_history enable row level security;

create policy "Authenticated users can view their company"
on public.companies for select to authenticated
using (public.is_super_admin() or id = public.current_company_id());

create policy "Super admins create companies"
on public.companies for insert to authenticated
with check (public.is_super_admin());

create policy "Super admins update companies"
on public.companies for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Users can view permitted profiles"
on public.profiles for select to authenticated
using (public.is_super_admin() or id = auth.uid() or company_id = public.current_company_id());

create policy "Users create their employee profile"
on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'employee' and status = 'pending');

create policy "Super admins create profiles"
on public.profiles for insert to authenticated
with check (public.is_super_admin());

create policy "Company admins create employees"
on public.profiles for insert to authenticated
with check (
  public.current_user_role() = 'company_admin'
  and role = 'employee'
  and company_id = public.current_company_id()
);

create policy "Admins manage profiles"
on public.profiles for update to authenticated
using (
  public.is_super_admin()
  or (public.current_user_role() = 'company_admin' and role = 'employee' and company_id = public.current_company_id())
)
with check (
  public.is_super_admin()
  or (public.current_user_role() = 'company_admin' and role = 'employee' and company_id = public.current_company_id())
);

create policy "Employees create employee requests"
on public.employee_requests for insert to authenticated
with check (employee_id = auth.uid() and company_id = public.current_company_id());

create policy "Admins view employee requests"
on public.employee_requests for select to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Admins review employee requests"
on public.employee_requests for update to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view departments"
on public.departments for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Admins manage departments"
on public.departments for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view catalog"
on public.categories for select to authenticated
using (
  public.is_super_admin()
  or (
    company_id = public.current_company_id()
    and (active or public.current_user_role() = 'company_admin')
  )
);

create policy "Admins manage categories"
on public.categories for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view products"
on public.products for select to authenticated
using (
  public.is_super_admin()
  or (
    company_id = public.current_company_id()
    and (active or public.current_user_role() = 'company_admin')
  )
);

create policy "Admins manage products"
on public.products for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view department products"
on public.department_products for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Admins manage department products"
on public.department_products for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Users view own favorites"
on public.favorites for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());

create policy "Users manage own favorites"
on public.favorites for insert to authenticated
with check (user_id = auth.uid() and (company_id = public.current_company_id() or public.is_super_admin()));

create policy "Users update own favorites"
on public.favorites for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users remove own favorites"
on public.favorites for delete to authenticated
using (user_id = auth.uid());

create policy "Users and admins view payment provider accounts"
on public.payment_provider_accounts for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id())
);

create policy "Company members view purchases"
on public.purchases for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Company members create purchases"
on public.purchases for insert to authenticated
with check ((company_id = public.current_company_id() or public.is_super_admin()) and purchaser_id = auth.uid());

create policy "Admins view payments"
on public.payments for select to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Users view own notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy "Users update own notifications"
on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Admins view audit history"
on public.audit_history for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

-- Product images should be uploaded to a private Supabase Storage bucket named product-images.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

create policy "Company admins upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or (
      public.current_user_role() = 'company_admin'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);

create policy "Company members view product images"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.current_company_id()::text
  )
);

create policy "Company admins manage product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (
    public.is_super_admin()
    or (
      public.current_user_role() = 'company_admin'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);