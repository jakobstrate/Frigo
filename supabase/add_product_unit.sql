alter table public.products
  add column if not exists unit text not null default '';
