-- Frigo database schema
-- Run this in Supabase Dashboard > SQL Editor on a new project.
-- Create Auth users first; profiles are linked to auth.users.

create type public.app_role as enum ('super_admin', 'company_admin', 'employee');
create type public.user_status as enum ('pending', 'active', 'rejected', 'inactive');
create type public.request_status as enum ('pending', 'accepted', 'declined');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_type as enum ('purchase', 'salary_withdrawal');

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null unique,
  inherited_from_company_id bigint references public.companies(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
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
  constraint one_open_request_per_employee unique (employee_id, company_id)
);

create table public.departments (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  name text not null,
  inherits_catalog boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.categories (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  department_id bigint references public.departments(id) on delete cascade,
  name text not null,
  copied_from_category_id bigint references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, department_id, name)
);

create table public.products (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  department_id bigint references public.departments(id) on delete cascade,
  category_id bigint references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  image_path text not null,
  copied_from_product_id bigint references public.products(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, department_id, name)
);

-- These tables make inherited/copied catalog entries explicit and allow exclusions.
create table public.department_categories (
  department_id bigint not null references public.departments(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  is_inherited boolean not null default true,
  primary key (department_id, category_id)
);

create table public.department_products (
  department_id bigint not null references public.departments(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  is_inherited boolean not null default true,
  primary key (department_id, product_id)
);

create table public.purchases (
  id bigint generated always as identity primary key,
  purchaser_id uuid not null references public.profiles(id) on delete restrict,
  company_id bigint not null references public.companies(id) on delete restrict,
  department_id bigint not null references public.departments(id) on delete restrict,
  product_id bigint not null references public.products(id) on delete restrict,
  purchaser_name text not null,
  department_name text not null,
  product_name text not null,
  amount integer not null check (amount > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) generated always as (amount * unit_price) stored,
  created_at timestamptz not null default now()
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
create index products_company_department_idx on public.products(company_id, department_id);
create index purchases_company_created_idx on public.purchases(company_id, created_at desc);
create index payments_company_paid_idx on public.payments(company_id, paid_at desc);
create index audit_history_company_created_idx on public.audit_history(company_id, created_at desc);

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
begin
  if old.role = 'company_admin'
     and old.status = 'active'
     and not exists (
       select 1 from public.profiles replacement
       where replacement.company_id = old.company_id
         and replacement.role = 'company_admin'
         and replacement.status = 'active'
         and replacement.id <> old.id
     ) then
    raise exception 'Select a replacement company admin before deleting this user';
  end if;
  return old;
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
before delete on public.profiles
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
alter table public.department_categories enable row level security;
alter table public.department_products enable row level security;
alter table public.purchases enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_history enable row level security;

create policy "Authenticated users can view their company"
on public.companies for select to authenticated
using (public.is_super_admin() or id = public.current_company_id());

create policy "Super admins manage companies"
on public.companies for all to authenticated
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
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Admins delete profiles"
on public.profiles for delete to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and role = 'employee' and company_id = public.current_company_id()));

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
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Admins manage categories"
on public.categories for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view products"
on public.products for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Admins manage products"
on public.products for all to authenticated
using (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()))
with check (public.is_super_admin() or (public.current_user_role() = 'company_admin' and company_id = public.current_company_id()));

create policy "Company members view department catalog"
on public.department_categories for select to authenticated
using (public.is_super_admin() or exists (select 1 from public.departments d where d.id = department_id and d.company_id = public.current_company_id()));

create policy "Company members view department products"
on public.department_products for select to authenticated
using (public.is_super_admin() or exists (select 1 from public.departments d where d.id = department_id and d.company_id = public.current_company_id()));

create policy "Company members view purchases"
on public.purchases for select to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "Company members create purchases"
on public.purchases for insert to authenticated
with check (company_id = public.current_company_id() and purchaser_id = auth.uid());

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
