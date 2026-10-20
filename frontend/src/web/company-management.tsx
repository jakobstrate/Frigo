import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';

type DepartmentDetails = { id: number; name: string };
type EditableDepartment = { id: number | null; name: string };
type CompanyAdminDetails = { id: string; displayName: string; email: string };

type CompanyDetails = {
  id: number;
  name: string;
  status: string;
  departments: DepartmentDetails[];
  admins: CompanyAdminDetails[];
  companyAdmins: number;
  employees: number;
};

function EditCompanyModal({
  company,
  onClose,
  onSaved,
  onError,
}: {
  company: CompanyDetails;
  onClose: () => void;
  onSaved: (name: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(company.name);
  const [departments, setDepartments] = useState<EditableDepartment[]>(() =>
    company.departments.map((department) => ({ ...department })),
  );
  const [newDepartment, setNewDepartment] = useState('');
  const [adminId, setAdminId] = useState(company.admins[0]?.id ?? '');
  const [adminName, setAdminName] = useState(company.admins[0]?.displayName ?? '');
  const [adminEmail, setAdminEmail] = useState(company.admins[0]?.email ?? '');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function addDepartment() {
    const departmentName = newDepartment.trim();
    if (!departmentName) return;
    if (departments.some((department) => department.name.toLowerCase() === departmentName.toLowerCase())) {
      setFormError('Afdelingen findes allerede.');
      return;
    }
    setFormError('');
    setDepartments((current) => [...current, { id: null, name: departmentName }]);
    setNewDepartment('');
  }

  function selectAdmin(id: string) {
    const selectedAdmin = company.admins.find((admin) => admin.id === id);
    setAdminId(id);
    setAdminName(selectedAdmin?.displayName ?? '');
    setAdminEmail(selectedAdmin?.email ?? '');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updatedName = name.trim();
    if (!updatedName || !adminId) return;

    setIsSaving(true);
    setFormError('');
    try {
      const { error } = await supabase.functions.invoke('update-company', {
        body: {
          companyId: company.id,
          companyName: updatedName,
          departments,
          adminId,
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
        },
      });

      if (error) {
        let message = error.message;
        if (error.context instanceof Response) {
          const responseBody: unknown = await error.context.json();
          if (responseBody !== null && typeof responseBody === 'object' && 'error' in responseBody && typeof responseBody.error === 'string') {
            message = responseBody.error;
          }
        }
        throw new Error(message);
      }

      await onSaved(updatedName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Virksomheden kunne ikke opdateres.';
      setFormError(message);
      onError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-admin-edit-company-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-edit-company-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-edit-company-title">Rediger virksomhed</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">
            ×
          </button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="frigo-edit-company-name">Virksomhedsnavn</label>
          <input
            id="frigo-edit-company-name"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <label htmlFor="frigo-edit-department-name">Afdelinger</label>
          <div className="frigo-admin-department-entry">
            <input
              id="frigo-edit-department-name"
              value={newDepartment}
              onChange={(event) => setNewDepartment(event.currentTarget.value)}
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
          <div className="frigo-admin-department-list" aria-label="Afdelinger">
            {departments.map((department, index) => (
              <span className="frigo-admin-department-chip" key={department.id ?? `new-${department.name}-${index}`}>
                {department.name}
                <button
                  className="frigo-admin-chip-remove"
                  type="button"
                  onClick={() => setDepartments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Fjern ${department.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="frigo-admin-modal-help">Afdelingsspecifikke kategorier og produktkoblinger følger afdelingen.</p>

          <p className="frigo-admin-form-section-label">Virksomhedsadmin</p>
          {company.admins.length > 1 && (
            <>
              <label htmlFor="frigo-edit-admin">Vælg administrator</label>
              <select id="frigo-edit-admin" value={adminId} onChange={(event) => selectAdmin(event.currentTarget.value)}>
                {company.admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>{admin.displayName} · {admin.email}</option>
                ))}
              </select>
            </>
          )}
          <div className="frigo-admin-admin-fields">
            <div>
              <label htmlFor="frigo-edit-admin-name">Navn</label>
              <input
                id="frigo-edit-admin-name"
                autoComplete="name"
                required
                value={adminName}
                onChange={(event) => setAdminName(event.currentTarget.value)}
              />
            </div>
            <div>
              <label htmlFor="frigo-edit-admin-email">E-mail</label>
              <input
                id="frigo-edit-admin-email"
                type="email"
                autoComplete="email"
                required
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.currentTarget.value)}
              />
            </div>
          </div>
          <p className="frigo-admin-modal-help">Hvis e-mailadressen ændres, bliver den nye adresse administratorens login.</p>
          {company.admins.length === 0 && (
            <p className="frigo-admin-error" role="alert">Virksomheden har ingen aktive administratorer, der kan redigeres.</p>
          )}
          {formError && <p className="frigo-admin-error" role="alert">Virksomheden kunne ikke opdateres: {formError}</p>}
          <div className="frigo-admin-modal-actions">
            <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>
              Annuller
            </button>
            <button className="frigo-admin-primary-button" type="submit" disabled={isSaving || !name.trim() || !adminId || !adminName.trim() || !adminEmail.trim()}>
              {isSaving ? 'Gemmer...' : 'Gem ændringer'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteCompanyModal({
  company,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: {
  company: CompanyDetails;
  isDeleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-admin-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="frigo-delete-company-title"
        aria-describedby="frigo-delete-company-description"
        aria-busy={isDeleting}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-delete-company-title">Slet virksomhed?</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isDeleting} aria-label="Luk">
            ×
          </button>
        </div>
        <p id="frigo-delete-company-description" className="frigo-admin-modal-help">
          <strong>{company.name}</strong> skjules fra oversigten. Historiske data bevares.
        </p>
        {error && <p className="frigo-admin-error" role="alert">{error}</p>}
        <div className="frigo-admin-modal-actions">
          <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isDeleting}>
            Annuller
          </button>
          <button className="frigo-admin-danger-button" type="button" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Sletter...' : 'Slet virksomhed'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CreateCompanyModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (companyName: string, adminEmail: string) => Promise<void>;
  onError: (message: string) => void;
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
      const message = error instanceof Error ? error.message : 'Virksomheden kunne ikke oprettes.';
      setFormError(message);
      onError(message);
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
  const [actionError, setActionError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyBeingEdited, setCompanyBeingEdited] = useState<CompanyDetails | null>(null);
  const [companyBeingDeleted, setCompanyBeingDeleted] = useState<CompanyDetails | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<number | null>(null);

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [companiesResult, departmentsResult, profilesResult] = await Promise.all([
      supabase.from('companies').select('id, name, status').neq('status', 'deleted').order('name'),
      supabase.from('departments').select('id, company_id, name').order('name'),
      supabase.from('profiles').select('id, company_id, role, status, display_name, email'),
    ]);

    const queryError = companiesResult.error ?? departmentsResult.error ?? profilesResult.error;
    if (queryError) {
      setLoadError(queryError.message);
      setIsLoading(false);
      return;
    }

    const departmentsByCompany = new Map<number, DepartmentDetails[]>();
    for (const department of departmentsResult.data ?? []) {
      const companyDepartments = departmentsByCompany.get(department.company_id) ?? [];
      companyDepartments.push({ id: department.id, name: department.name });
      departmentsByCompany.set(department.company_id, companyDepartments);
    }

    const profileCounts = new Map<number, { companyAdmins: number; employees: number; admins: CompanyAdminDetails[] }>();
    for (const profile of profilesResult.data ?? []) {
      if (profile.company_id === null) continue;
      const counts = profileCounts.get(profile.company_id) ?? { companyAdmins: 0, employees: 0, admins: [] };
      if (profile.role === 'company_admin') {
        counts.companyAdmins += 1;
        if (profile.status === 'active') {
          counts.admins.push({ id: profile.id, displayName: profile.display_name, email: profile.email });
        }
      }
      if (profile.role === 'employee') counts.employees += 1;
      profileCounts.set(profile.company_id, counts);
    }

    setCompanies((companiesResult.data ?? []).map((company) => {
      const counts = profileCounts.get(company.id) ?? { companyAdmins: 0, employees: 0, admins: [] };
      return {
        ...company,
        departments: departmentsByCompany.get(company.id) ?? [],
        companyAdmins: counts.companyAdmins,
        employees: counts.employees,
        admins: counts.admins,
      };
    }));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  async function handleCompanyCreated(companyName: string, adminEmail: string) {
    setIsModalOpen(false);
    setActionError('');
    setSuccessMessage(`Virksomheden ${companyName} er oprettet. Invitationen er sendt til ${adminEmail}.`);
    await loadCompanies();
  }

  async function handleCompanyUpdated(name: string) {
    setCompanyBeingEdited(null);
    setActionError('');
    setSuccessMessage(`${name} er opdateret.`);
    await loadCompanies();
  }

  async function handleCompanyDelete(company: CompanyDetails) {
    setDeletingCompanyId(company.id);
    setActionError('');
    setSuccessMessage('');
    const { error } = await supabase
      .from('companies')
      .update({ status: 'deleted' })
      .eq('id', company.id);

    if (error) {
      setActionError(`Virksomheden kunne ikke slettes: ${error.message}`);
    } else {
      setCompanyBeingDeleted(null);
      setSuccessMessage(`${company.name} er slettet fra oversigten.`);
      await loadCompanies();
    }

    setDeletingCompanyId(null);
  }

  return (
    <>
      {successMessage && <p className="frigo-admin-notice" role="status">{successMessage}</p>}
      {actionError && <p className="frigo-admin-error" role="alert">{actionError}</p>}
      {loadError && <p className="frigo-admin-error" role="alert">Virksomheder kunne ikke indlæses: {loadError}</p>}
      <div className="frigo-admin-section-header">
        <div>
          <h2>Alle virksomheder</h2>
        </div>
        <button
          className="frigo-admin-primary-button"
          type="button"
          onClick={() => {
            setSuccessMessage('');
            setActionError('');
            setIsModalOpen(true);
          }}
        >
          <span aria-hidden="true">+</span>
          Opret virksomhed
        </button>
      </div>
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
                    <span className="frigo-admin-company-department" key={department.id}>{department.name}</span>
                  ))
                  : <span className="frigo-admin-company-department">Hele virksomheden</span>}
              </div>
              <p className="frigo-admin-company-meta">
                {company.companyAdmins} virksomhedsadmin · {company.employees} brugere
              </p>
              <div className="frigo-admin-company-actions">
                <button
                  className="frigo-admin-secondary-button"
                  type="button"
                  onClick={() => {
                    setSuccessMessage('');
                    setActionError('');
                    setCompanyBeingEdited(company);
                  }}
                >
                  Rediger
                </button>
                <button
                  className="frigo-admin-delete-button"
                  type="button"
                  onClick={() => {
                    setSuccessMessage('');
                    setActionError('');
                    setCompanyBeingDeleted(company);
                  }}
                  disabled={deletingCompanyId === company.id}
                  aria-label={`Slet ${company.name}`}
                  title={`Slet ${company.name}`}
                >
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 5v5m4-5v5" />
                  </svg>
                </button>
              </div>
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
          onError={setActionError}
        />
      )}
      {companyBeingEdited && (
        <EditCompanyModal
          company={companyBeingEdited}
          onClose={() => setCompanyBeingEdited(null)}
          onSaved={handleCompanyUpdated}
          onError={setActionError}
        />
      )}
      {companyBeingDeleted && (
        <DeleteCompanyModal
          company={companyBeingDeleted}
          isDeleting={deletingCompanyId === companyBeingDeleted.id}
          error={actionError}
          onClose={() => setCompanyBeingDeleted(null)}
          onConfirm={() => void handleCompanyDelete(companyBeingDeleted)}
        />
      )}
    </>
  );
}
