import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/backend/src/supabase';
import type { AdminRole } from '@/frontend/src/web/admin-access';

type Company = { id: number; name: string };
type Department = { id: number; company_id: number; name: string };
type RequestPerson = { id: string; display_name: string; email: string };
type EmployeeRequest = {
  id: number;
  employee_id: string;
  company_id: number | null;
  requested_admin_id: string | null;
  created_at: string;
  person: RequestPerson | null;
  companyName: string;
};
type DeletionRequest = {
  id: number;
  user_id: string;
  company_id: number;
  requested_admin_id: string | null;
  created_at: string;
  person: RequestPerson | null;
};

function formatRequestTime(timestamp: string) {
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || '?';
}

export default function AdminReview({
  role,
  companyId,
  onRequestsChanged,
}: {
  role: AdminRole;
  companyId: number | null;
  onRequestsChanged: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeRequests, setEmployeeRequests] = useState<EmployeeRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Record<number, number>>({});
  const [selectedDepartments, setSelectedDepartments] = useState<Record<number, number | null | undefined>>({});
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (sessionError || !user) {
      setError(sessionError?.message ?? 'Log ind igen for at se anmodninger.');
      setIsLoading(false);
      return;
    }
    const companyQuery = supabase
      .from('companies')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    const [{ data: companyRows, error: companiesError }, employeeRequestResult, deletionRequestResult] = await Promise.all([
      role === 'super_admin'
        ? companyQuery
        : supabase.from('companies').select('id, name').eq('id', companyId ?? -1).eq('status', 'active'),
      (() => {
        let query = supabase
          .from('employee_requests')
          .select('id, employee_id, company_id, requested_admin_id, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (role === 'super_admin') query = query.eq('requested_admin_id', user.id);
        else query = query.eq('company_id', companyId ?? -1);
        return query;
      })(),
      (() => {
        let query = supabase
          .from('account_deletion_requests')
          .select('id, user_id, company_id, requested_admin_id, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (role === 'super_admin') query = query.eq('requested_admin_id', user.id);
        else query = query.eq('company_id', companyId ?? -1);
        return query;
      })(),
    ]);

    const requestsError = companiesError ?? employeeRequestResult.error ?? deletionRequestResult.error;
    if (requestsError) {
      setError(requestsError.message);
      setIsLoading(false);
      return;
    }

    const companyList = companyRows ?? [];
    setCompanies(companyList);
    const employeeRows = employeeRequestResult.data ?? [];
    const deletionRows = deletionRequestResult.data ?? [];
    const profileIds = [...new Set([
      ...employeeRows.map((request) => request.employee_id),
      ...deletionRows.map((request) => request.user_id),
    ])];
    const requestedCompanyIds = [...new Set(employeeRows
      .map((request) => request.company_id)
      .filter((id): id is number => id !== null))];
    const [{ data: people, error: peopleError }, { data: requestedCompanies, error: requestedCompaniesError }, { data: departmentRows, error: departmentsError }] = await Promise.all([
      profileIds.length
        ? supabase.from('profiles').select('id, display_name, email').in('id', profileIds)
        : Promise.resolve({ data: [] as RequestPerson[], error: null }),
      requestedCompanyIds.length
        ? supabase.from('companies').select('id, name').in('id', requestedCompanyIds)
        : Promise.resolve({ data: [] as Company[], error: null }),
      companyList.length
        ? supabase.from('departments').select('id, company_id, name').in('company_id', companyList.map(({ id }) => id)).order('name')
        : Promise.resolve({ data: [] as Department[], error: null }),
    ]);
    const detailError = peopleError ?? requestedCompaniesError ?? departmentsError;
    if (detailError) {
      setError(detailError.message);
      setIsLoading(false);
      return;
    }

    const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
    const companiesById = new Map((requestedCompanies ?? []).map((company) => [company.id, company.name]));
    setDepartments(departmentRows ?? []);
    setEmployeeRequests(employeeRows.map((request) => ({
      ...request,
      person: peopleById.get(request.employee_id) ?? null,
      companyName: request.company_id === null ? '' : companiesById.get(request.company_id) ?? '',
    })));
    setDeletionRequests(deletionRows.map((request) => ({
      ...request,
      person: peopleById.get(request.user_id) ?? null,
    })));
    setIsLoading(false);
  }, [companyId, role]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const departmentsByCompany = useMemo(() => {
    const result = new Map<number, Department[]>();
    for (const department of departments) {
      result.set(department.company_id, [...(result.get(department.company_id) ?? []), department]);
    }
    return result;
  }, [departments]);

  async function reviewEmployee(request: EmployeeRequest, accept: boolean) {
    const requestCompanyId = request.company_id
      ?? selectedCompanies[request.id]
      ?? null;
    if (accept && requestCompanyId === null) {
      setError('Vælg en virksomhed, før anmodningen godkendes.');
      return;
    }

    setBusyRequest(`employee-${request.id}`);
    setError('');
    setNotice('');
    const { error: reviewError } = await supabase.rpc('review_employee_request', {
      p_request_id: request.id,
      p_accept: accept,
      p_company_id: accept ? requestCompanyId : null,
      p_department_id: accept ? selectedDepartments[request.id] ?? null : null,
      p_decline_reason: null,
    });
    setBusyRequest(null);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }

    setNotice(accept ? 'Brugeren er godkendt.' : 'Adgangsanmodningen er afvist.');
    onRequestsChanged();
    await loadRequests();
  }

  async function reviewDeletion(request: DeletionRequest, accept: boolean) {
    setBusyRequest(`deletion-${request.id}`);
    setError('');
    setNotice('');
    const { error: reviewError } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'review-account-deletion-request',
        requestId: request.id,
        accept,
      },
    });
    setBusyRequest(null);
    if (reviewError) {
      const response = reviewError.context instanceof Response
        ? await reviewError.context.json().catch(() => null) as { error?: string } | null
        : null;
      setError(response?.error ?? reviewError.message);
      return;
    }

    setNotice(accept ? 'Brugerens konto er slettet.' : 'Sletningsanmodningen er afvist.');
    onRequestsChanged();
    await loadRequests();
  }

  return (
    <div className="frigo-requests">
      <div className="frigo-requests-intro">
        <p>Gennemgå nye brugeres adgang og anmodninger om sletning af konto.</p>
      </div>
      {error && <p className="frigo-admin-error" role="alert">{error}</p>}
      {notice && <p className="frigo-admin-notice" role="status">{notice}</p>}

      <section className="frigo-request-panel" aria-labelledby="frigo-new-user-requests-title">
        <div className="frigo-request-panel-heading">
          <h2 id="frigo-new-user-requests-title">Nye brugere</h2>
          <span>{employeeRequests.length}</span>
        </div>
        {isLoading ? (
          <p className="frigo-request-empty" role="status">Indlæser anmodninger...</p>
        ) : employeeRequests.length === 0 ? (
          <p className="frigo-request-empty">Der er ingen adgangsanmodninger.</p>
        ) : (
          <div className="frigo-request-list">
            {employeeRequests.map((request) => {
              const personName = request.person?.display_name ?? 'Ukendt bruger';
              const selectedCompanyId = request.company_id ?? selectedCompanies[request.id] ?? null;
              const rowBusy = isLoading || busyRequest === `employee-${request.id}`;
              return (
                <article className="frigo-request-row" key={request.id}>
                  <span className="frigo-request-avatar" aria-hidden="true">{initials(personName)}</span>
                  <div className="frigo-request-person">
                    <strong>{personName}</strong>
                    <span>{request.person?.email ?? 'E-mail ikke tilgængelig'}</span>
                    <small>{request.companyName || 'Virksomhed ikke valgt'} · {formatRequestTime(request.created_at)}</small>
                  </div>
                  {role === 'super_admin' && request.company_id === null ? (
                    <label className="frigo-request-department-field">
                      <span>Virksomhed</span>
                      <select
                        value={selectedCompanies[request.id] ?? ''}
                        onChange={(event) => {
                          const nextCompanyId = event.currentTarget.value ? Number(event.currentTarget.value) : null;
                          setSelectedCompanies((current) => nextCompanyId === null
                            ? current
                            : { ...current, [request.id]: nextCompanyId });
                          setSelectedDepartments((current) => ({ ...current, [request.id]: undefined }));
                        }}
                      >
                        <option value="">Vælg virksomhed</option>
                        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className="frigo-request-department-field">
                    <span>Afdeling</span>
                    <select
                      value={selectedDepartments[request.id] === undefined
                        ? ''
                        : selectedDepartments[request.id] === null
                          ? 'all'
                          : String(selectedDepartments[request.id])}
                      onChange={(event) => {
                        const departmentValue = event.currentTarget.value;
                        setSelectedDepartments((current) => ({
                          ...current,
                          [request.id]: departmentValue === ''
                            ? undefined
                            : departmentValue === 'all'
                              ? null
                              : Number(departmentValue),
                        }));
                      }}
                      disabled={selectedCompanyId === null}
                    >
                      <option value="">Vælg afdeling</option>
                      <option value="all">Hele virksomheden</option>
                      {(departmentsByCompany.get(selectedCompanyId ?? -1) ?? []).map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="frigo-request-actions">
                    <button
                      className="frigo-admin-secondary-button"
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void reviewEmployee(request, false)}
                    >
                      Afvis
                    </button>
                    <button
                      className="frigo-admin-primary-button"
                      type="button"
                      disabled={rowBusy || selectedCompanyId === null}
                      onClick={() => void reviewEmployee(request, true)}
                    >
                      {rowBusy ? 'Gemmer...' : 'Godkend'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="frigo-request-panel" aria-labelledby="frigo-deletion-requests-title">
        <div className="frigo-request-panel-heading">
          <h2 id="frigo-deletion-requests-title">Anmodninger om sletning</h2>
          <span>{deletionRequests.length}</span>
        </div>
        {isLoading ? (
          <p className="frigo-request-empty" role="status">Indlæser anmodninger...</p>
        ) : deletionRequests.length === 0 ? (
          <p className="frigo-request-empty">Der er ingen sletningsanmodninger.</p>
        ) : (
          <div className="frigo-request-list">
            {deletionRequests.map((request) => {
              const personName = request.person?.display_name ?? 'Ukendt bruger';
              const rowBusy = isLoading || busyRequest === `deletion-${request.id}`;
              return (
                <article className="frigo-request-row frigo-request-row-deletion" key={request.id}>
                  <span className="frigo-request-avatar is-deletion" aria-hidden="true">{initials(personName)}</span>
                  <div className="frigo-request-person">
                    <strong>{personName}</strong>
                    <span>{request.person?.email ?? 'E-mail ikke tilgængelig'}</span>
                    <small>{formatRequestTime(request.created_at)}</small>
                  </div>
                  <div className="frigo-request-actions">
                    <button
                      className="frigo-admin-secondary-button"
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void reviewDeletion(request, false)}
                    >
                      Afvis anmodning
                    </button>
                    <button
                      className="frigo-admin-danger-button"
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void reviewDeletion(request, true)}
                    >
                      {rowBusy ? 'Gemmer...' : 'Slet bruger'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
