import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';

type CompanyDetails = {
  id: number;
  name: string;
  status: string;
  departments: string[];
  companyAdmins: number;
  employees: number;
};

function CreateCompanyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (companyName: string, adminEmail: string) => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function addDepartment() {
    const nextDepartment = departmentName.trim();
    if (!nextDepartment) return;
    if (departments.some((department) => department.toLowerCase() === nextDepartment.toLowerCase())) {
      setFormError('Afdelingen er allerede tilføjet.');
      return;
    }
    setFormError('');
    setDepartments((current) => [...current, nextDepartment]);
    setDepartmentName('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError('');

    try {
      const { error } = await supabase.functions.invoke('create-company', {
        body: {
          companyName: companyName.trim(),
          departments,
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
        },
      });

      if (error) {
        let message = error.message;
        if (error.context instanceof Response) {
          const responseBody: unknown = await error.context.json();
          if (
            responseBody !== null
            && typeof responseBody === 'object'
            && 'error' in responseBody
            && typeof responseBody.error === 'string'
          ) {
            message = responseBody.error;
          }
        }
        throw new Error(message);
      }

      await onCreated(companyName.trim(), adminEmail.trim());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Virksomheden kunne ikke oprettes.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-create-company-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-create-company-title">Opret virksomhed</h2>
          <button
            className="frigo-admin-modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Luk"
          >
            ×
          </button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="frigo-company-name">Virksomhedsnavn</label>
          <input
            id="frigo-company-name"
            autoFocus
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.currentTarget.value)}
            placeholder="Fx MWL"
          />

          <label htmlFor="frigo-department-name">Afdelinger</label>
          <div className="frigo-admin-department-entry">
            <input
              id="frigo-department-name"
              value={departmentName}
              onChange={(event) => setDepartmentName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addDepartment();
                }
              }}
              placeholder="Tilføj afdeling"
            />
            <button type="button" onClick={addDepartment}>Tilføj</button>
          </div>
          <div className="frigo-admin-department-list" aria-label="Tilføjede afdelinger">
            {departments.map((department, index) => (
              <span className="frigo-admin-department-chip" key={`${department}-${index}`}>
                {department}
                <button
                  className="frigo-admin-chip-remove"
                  type="button"
                  onClick={() => setDepartments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Fjern ${department}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="frigo-admin-modal-help">Ingen afdelinger? Så samles alle brugere under hele virksomheden.</p>

          <p className="frigo-admin-form-section-label">Virksomhedsadmin</p>
          <div className="frigo-admin-admin-fields">
            <div>
              <label htmlFor="frigo-admin-name">Navn</label>
              <input
                id="frigo-admin-name"
                autoComplete="name"
                required
                value={adminName}
                onChange={(event) => setAdminName(event.currentTarget.value)}
              />
            </div>
            <div>
              <label htmlFor="frigo-admin-email">E-mail</label>
              <input
                id="frigo-admin-email"
                type="email"
                autoComplete="email"
                required
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.currentTarget.value)}
              />
            </div>
          </div>
          <p className="frigo-admin-modal-help">
            Vi sender en invitation til administratorens e-mail. Flere administratorer kan tilføjes senere under
            Brugere.
          </p>

          {formError && <p className="frigo-admin-error" role="alert">{formError}</p>}
          <div className="frigo-admin-modal-actions">
            <button
              className="frigo-admin-secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Annuller
            </button>
            <button className="frigo-admin-primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Opretter...' : 'Opret og send invitation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<CompanyDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [companiesResult, departmentsResult, profilesResult] = await Promise.all([
      supabase.from('companies').select('id, name, status').order('name'),
      supabase.from('departments').select('company_id, name').order('name'),
      supabase.from('profiles').select('company_id, role'),
    ]);

    const queryError = companiesResult.error ?? departmentsResult.error ?? profilesResult.error;
    if (queryError) {
      setLoadError(queryError.message);
      setIsLoading(false);
      return;
    }

    const departmentsByCompany = new Map<number, string[]>();
    for (const department of departmentsResult.data ?? []) {
      const companyDepartments = departmentsByCompany.get(department.company_id) ?? [];
      companyDepartments.push(department.name);
      departmentsByCompany.set(department.company_id, companyDepartments);
    }

    const profileCounts = new Map<number, { companyAdmins: number; employees: number }>();
    for (const profile of profilesResult.data ?? []) {
      if (profile.company_id === null) continue;
      const counts = profileCounts.get(profile.company_id) ?? { companyAdmins: 0, employees: 0 };
      if (profile.role === 'company_admin') counts.companyAdmins += 1;
      if (profile.role === 'employee') counts.employees += 1;
      profileCounts.set(profile.company_id, counts);
    }

    setCompanies((companiesResult.data ?? []).map((company) => {
      const counts = profileCounts.get(company.id) ?? { companyAdmins: 0, employees: 0 };
      return {
        ...company,
        departments: departmentsByCompany.get(company.id) ?? [],
        companyAdmins: counts.companyAdmins,
        employees: counts.employees,
      };
    }));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  async function handleCompanyCreated(companyName: string, adminEmail: string) {
    setIsModalOpen(false);
    setSuccessMessage(`Virksomheden ${companyName} er oprettet. Invitationen er sendt til ${adminEmail}.`);
    await loadCompanies();
  }

  return (
    <>
      <div className="frigo-admin-section-header">
        <div>
          <h2>Alle virksomheder</h2>
        </div>
        <button
          className="frigo-admin-primary-button"
          type="button"
          onClick={() => {
            setSuccessMessage('');
            setIsModalOpen(true);
          }}
        >
          <span aria-hidden="true">+</span>
          Opret virksomhed
        </button>
      </div>
      {successMessage && <p className="frigo-admin-notice" role="status">{successMessage}</p>}
      {loadError && <p className="frigo-admin-error" role="alert">Virksomheder kunne ikke indlæses: {loadError}</p>}
      {isLoading ? (
        <div className="frigo-admin-company-message" role="status">Indlæser virksomheder...</div>
      ) : companies.length > 0 ? (
        <div className="frigo-admin-company-grid">
          {companies.map((company) => (
            <article className="frigo-admin-company-card" key={company.id}>
              <div className="frigo-admin-company-card-header">
                <h3>{company.name}</h3>
                <span className={`frigo-admin-status${company.status === 'active' ? '' : ' is-inactive'}`}>
                  {company.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <div className="frigo-admin-company-departments">
                {company.departments.length > 0
                  ? company.departments.map((department) => (
                    <span className="frigo-admin-company-department" key={department}>{department}</span>
                  ))
                  : <span className="frigo-admin-company-department">Hele virksomheden</span>}
              </div>
              <p className="frigo-admin-company-meta">
                {company.companyAdmins} virksomhedsadmin · {company.employees} brugere
              </p>
            </article>
          ))}
        </div>
      ) : !loadError ? (
        <div className="frigo-admin-company-message">Der er endnu ikke oprettet nogen virksomheder.</div>
      ) : null}
      {isModalOpen && (
        <CreateCompanyModal
          onClose={() => setIsModalOpen(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </>
  );
}
