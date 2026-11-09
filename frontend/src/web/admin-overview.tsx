import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/backend/src/supabase';

type CompanyStatus = 'active' | 'inactive';
type CompanyOverview = {
  id: number;
  name: string;
  status: CompanyStatus;
  createdAt: string;
  companyAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
  consumption: number;
};
type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; companies: CompanyOverview[] };
type StatusFilter = 'all' | CompanyStatus;
type SortOption = 'alphabetical' | 'date' | 'status';

function getCurrentPeriod(now = new Date()) {
  const start = now.getDate() >= 21
    ? new Date(now.getFullYear(), now.getMonth(), 21)
    : new Date(now.getFullYear(), now.getMonth() - 1, 21);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 20);
  const endExclusive = new Date(start.getFullYear(), start.getMonth() + 1, 21);
  return { start, end, endExclusive };
}

function formatPeriodDate(date: Date, includeYear: boolean) {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AdminOverview() {
  const [overview, setOverview] = useState<OverviewState>({ status: 'loading' });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('alphabetical');
  const period = useMemo(() => getCurrentPeriod(), []);
  const periodLabel = period.start.getFullYear() === period.end.getFullYear()
    ? `Periode ${formatPeriodDate(period.start, false)} – ${formatPeriodDate(period.end, true)}`
    : `Periode ${formatPeriodDate(period.start, true)} – ${formatPeriodDate(period.end, true)}`;

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        const [companiesResult, profilesResult, purchasesResult] = await Promise.all([
          supabase
            .from('companies')
            .select('id, name, status, created_at')
            .neq('status', 'deleted')
            .order('name'),
          supabase
            .from('profiles')
            .select('company_id, role, status')
            .neq('status', 'deleted'),
          supabase
            .from('purchases')
            .select('company_id, total_price')
            .gte('created_at', period.start.toISOString())
            .lt('created_at', period.endExclusive.toISOString()),
        ]);
        if (!isMounted) return;

        const queryError = companiesResult.error ?? profilesResult.error ?? purchasesResult.error;
        if (queryError) {
          setOverview({ status: 'error', message: queryError.message });
          return;
        }

        const countsByCompany = new Map<number, { companyAdmins: number; activeUsers: number; inactiveUsers: number }>();
        for (const profile of profilesResult.data ?? []) {
          if (profile.company_id === null) continue;
          const counts = countsByCompany.get(profile.company_id) ?? {
            companyAdmins: 0,
            activeUsers: 0,
            inactiveUsers: 0,
          };
          if (profile.role === 'company_admin') counts.companyAdmins += 1;
          if (profile.role === 'employee' && profile.status === 'active') counts.activeUsers += 1;
          if (profile.role === 'employee' && profile.status === 'inactive') counts.inactiveUsers += 1;
          countsByCompany.set(profile.company_id, counts);
        }

        const consumptionByCompany = new Map<number, number>();
        for (const purchase of purchasesResult.data ?? []) {
          consumptionByCompany.set(
            purchase.company_id,
            (consumptionByCompany.get(purchase.company_id) ?? 0) + Number(purchase.total_price),
          );
        }

        const companies = (companiesResult.data ?? []).map((company): CompanyOverview => {
          const counts = countsByCompany.get(company.id);
          return {
            id: company.id,
            name: company.name,
            status: company.status === 'inactive' ? 'inactive' : 'active',
            createdAt: company.created_at,
            companyAdmins: counts?.companyAdmins ?? 0,
            activeUsers: counts?.activeUsers ?? 0,
            inactiveUsers: counts?.inactiveUsers ?? 0,
            consumption: consumptionByCompany.get(company.id) ?? 0,
          };
        });
        setOverview({ status: 'ready', companies });
      } catch (error) {
        if (!isMounted) return;
        setOverview({
          status: 'error',
          message: error instanceof Error ? error.message : 'Ukendt fejl ved indlæsning af overblikket.',
        });
      }
    }

    void loadOverview();
    return () => {
      isMounted = false;
    };
  }, [period.endExclusive, period.start]);

  const companies = overview.status === 'ready' ? overview.companies : [];
  const activeUsers = companies.reduce((total, company) => total + company.activeUsers, 0);
  const inactiveUsers = companies.reduce((total, company) => total + company.inactiveUsers, 0);
  const companyAdmins = companies.reduce((total, company) => total + company.companyAdmins, 0);
  const consumption = companies.reduce((total, company) => total + company.consumption, 0);
  const activeCompanies = companies.filter((company) => company.status === 'active').length;
  const companiesWithoutAdmin = companies.filter((company) => company.companyAdmins === 0);

  const visibleCompanies = useMemo(() => {
    const filtered = companies.filter((company) => statusFilter === 'all' || company.status === statusFilter);
    return [...filtered].sort((a, b) => {
      if (sortOption === 'date') return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'da');
      if (sortOption === 'status') {
        return a.status.localeCompare(b.status) || a.name.localeCompare(b.name, 'da');
      }
      return a.name.localeCompare(b.name, 'da');
    });
  }, [companies, sortOption, statusFilter]);

  if (overview.status === 'loading') {
    return <div className="frigo-admin-company-message" role="status">Indlæser overblik...</div>;
  }
  if (overview.status === 'error') {
    return <p className="frigo-admin-error" role="alert">Overblikket kunne ikke indlæses: {overview.message}</p>;
  }

  return (
    <section className="frigo-admin-overview">
      <p className="frigo-admin-overview-period">{periodLabel}</p>
      <div className="frigo-admin-overview-summary">
        <article className="frigo-admin-overview-card">
          <span>Forbrug i perioden</span>
          <strong>{formatCurrency(consumption)}</strong>
          <small>{consumption === 0 ? 'Ingen registreringer i perioden' : 'Samlet for alle virksomheder'}</small>
        </article>
        <article className="frigo-admin-overview-card">
          <span>Aktive brugere</span>
          <strong>{activeUsers}</strong>
          <small>{inactiveUsers} inaktive</small>
        </article>
        <article className="frigo-admin-overview-card">
          <span>Virksomhedsadmins</span>
          <strong>{companyAdmins}</strong>
          <small>
            {companies.length === 0
              ? 'Ingen virksomheder endnu'
              : companiesWithoutAdmin.length === 0
                ? 'Alle virksomheder har en admin'
                : `${companiesWithoutAdmin[0].name} mangler en${companiesWithoutAdmin.length > 1 ? ` · +${companiesWithoutAdmin.length - 1}` : ''}`}
          </small>
        </article>
        <article className="frigo-admin-overview-card">
          <span>Virksomheder</span>
          <strong>{companies.length}</strong>
          <small>{activeCompanies} aktive</small>
        </article>
      </div>

      <section className="frigo-admin-overview-table-panel" aria-labelledby="frigo-overview-table-title">
        <div className="frigo-admin-overview-table-heading">
          <h2 id="frigo-overview-table-title">Forbrug pr. virksomhed</h2>
          <div className="frigo-admin-overview-controls">
            <div className="frigo-admin-overview-control-group" aria-label="Filtrer efter status">
              <span>Status</span>
              {([
                ['all', 'Alle'],
                ['active', 'Aktive'],
                ['inactive', 'Inaktive'],
              ] as const).map(([value, label]) => (
                <button
                  className={statusFilter === value ? 'is-selected' : ''}
                  type="button"
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="frigo-admin-overview-control-group" aria-label="Sortér virksomheder">
              <span>Sortér</span>
              {([
                ['alphabetical', 'Alfabetisk'],
                ['date', 'Dato'],
                ['status', 'Status'],
              ] as const).map(([value, label]) => (
                <button
                  className={sortOption === value ? 'is-selected' : ''}
                  type="button"
                  key={value}
                  onClick={() => setSortOption(value)}
                  aria-pressed={sortOption === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {companies.length === 0 ? (
          <p className="frigo-admin-overview-empty">Der er endnu ingen virksomheder.</p>
        ) : (
          <div className="frigo-admin-overview-table-scroll">
            <table className="frigo-admin-overview-table">
              <thead>
                <tr>
                  <th scope="col">Virksomhed</th>
                  <th scope="col">Oprettet</th>
                  <th scope="col">Virksomhedsadmins</th>
                  <th scope="col">Brugere</th>
                  <th scope="col">Forbrug</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleCompanies.map((company) => (
                  <tr key={company.id}>
                    <th scope="row">{company.name}</th>
                    <td>{formatPeriodDate(new Date(company.createdAt), true)}</td>
                    <td>{company.companyAdmins}</td>
                    <td>{company.activeUsers} aktive · {company.inactiveUsers} inaktive</td>
                    <td>{formatCurrency(company.consumption)}</td>
                    <td><span className={`frigo-admin-overview-status is-${company.status}`}>{company.status === 'active' ? 'Aktiv' : 'Inaktiv'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCompanies.length === 0 && <p className="frigo-admin-overview-empty">Ingen virksomheder matcher filteret.</p>}
          </div>
        )}
      </section>
    </section>
  );
}
