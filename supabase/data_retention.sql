-- Apply after schema.sql and auth_flow.sql.
-- Deleted profiles and companies retain their accounting records for five years.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_expired_deleted_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.payments payment
  where payment.user_id in (
    select profile.id
    from public.profiles profile
    left join public.companies company on company.id = profile.company_id
    where profile.status = 'deleted'
      and (
        profile.deleted_at <= now() - interval '5 years'
        or (company.status = 'deleted' and company.deleted_at <= now() - interval '5 years')
      )
  )
  or payment.company_id in (
    select id from public.companies
    where status = 'deleted' and deleted_at <= now() - interval '5 years'
  );

  delete from public.purchases purchase
  where purchase.purchaser_id in (
    select profile.id
    from public.profiles profile
    left join public.companies company on company.id = profile.company_id
    where profile.status = 'deleted'
      and (
        profile.deleted_at <= now() - interval '5 years'
        or (company.status = 'deleted' and company.deleted_at <= now() - interval '5 years')
      )
  )
  or purchase.company_id in (
    select id from public.companies
    where status = 'deleted' and deleted_at <= now() - interval '5 years'
  );

  delete from public.payment_provider_accounts account
  where account.user_id in (
    select profile.id
    from public.profiles profile
    left join public.companies company on company.id = profile.company_id
    where profile.status = 'deleted'
      and (
        profile.deleted_at <= now() - interval '5 years'
        or (company.status = 'deleted' and company.deleted_at <= now() - interval '5 years')
      )
  )
  or account.company_id in (
    select id from public.companies
    where status = 'deleted' and deleted_at <= now() - interval '5 years'
  );

  delete from auth.users auth_user
  where exists (
    select 1
    from public.profiles profile
    left join public.companies company on company.id = profile.company_id
    where profile.id = auth_user.id
      and profile.status = 'deleted'
      and (
        profile.deleted_at <= now() - interval '5 years'
        or (company.status = 'deleted' and company.deleted_at <= now() - interval '5 years')
      )
  );

  delete from public.companies company
  where company.status = 'deleted'
    and company.deleted_at <= now() - interval '5 years';
end;
$$;

revoke all on function public.purge_expired_deleted_data() from public, anon, authenticated;
grant execute on function public.purge_expired_deleted_data() to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'frigo-purge-expired-deleted-data'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'frigo-purge-expired-deleted-data',
    '15 3 * * *',
    'select public.purge_expired_deleted_data();'
  );
end;
$$;
