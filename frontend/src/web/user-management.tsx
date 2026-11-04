import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';
import type { AdminRole } from '@/frontend/src/web/admin-access';

type Company = { id: number; name: string };
type Department = { id: number; company_id: number; name: string };
type UserStatus = 'active' | 'inactive' | 'pending' | 'rejected' | 'deleted';
type UserRole = 'super_admin' | 'company_admin' | 'employee';
type ManagedUser = {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  company_id: number | null;
  department_id: number | null;
  avatar_path: string | null;
  avatar_url: string | null;
};
type UserInput = {
  name: string;
  email: string;
  role: UserRole;
  companyId: number | null;
  departmentId: number | null;
  status: UserStatus;
  image?: File;
};
type StatusFilter = 'all' | 'active' | 'inactive';

async function getFunctionError(error: { message: string; context?: unknown }) {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      return error.message;
    }
  }
  return error.message;
}

function roleLabel(role: UserRole) {
  if (role === 'super_admin') return 'Superadmin';
  return role === 'company_admin' ? 'Virksomhedsadmin' : 'Medarbejder';
}

function statusLabel(status: UserStatus) {
  if (status === 'active') return 'Aktiv';
  if (status === 'inactive') return 'Inaktiv';
  if (status === 'pending') return 'Afventer';
  if (status === 'rejected') return 'Afvist';
  return 'Slettet';
}

function UserAvatar({ user }: { user: Pick<ManagedUser, 'display_name' | 'avatar_url'> }) {
  return user.avatar_url ? (
    <img className="frigo-user-avatar-image" src={user.avatar_url} alt="" />
  ) : (
    <span className="frigo-user-avatar-placeholder" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.7 3.2-5.5 7-5.5s6.3 1.8 7 5.5" />
      </svg>
    </span>
  );
}

function UserModal({
  user,
  companies,
  departments,
  role: actorRole,
  companyId: actorCompanyId,
  onClose,
  onSubmit,
}: {
  user: ManagedUser | null;
  companies: Company[];
  departments: Department[];
  role: AdminRole;
  companyId: number | null;
  onClose: () => void;
  onSubmit: (input: UserInput, userId?: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(user?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [userRole, setUserRole] = useState<UserRole>(user?.role ?? 'employee');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    user?.company_id ?? (actorRole === 'company_admin' ? actorCompanyId : companies[0]?.id ?? null),
  );
  const [departmentId, setDepartmentId] = useState<number | null>(user?.department_id ?? null);
  const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active');
  const [image, setImage] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!image) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const companyDepartments = useMemo(
    () => departments.filter((department) => department.company_id === selectedCompanyId),
    [departments, selectedCompanyId],
  );

  function handleCompanyChange(value: string) {
    const nextCompanyId = value ? Number(value) : null;
    setSelectedCompanyId(nextCompanyId);
    if (departmentId !== null && !departments.some((department) =>
      department.id === departmentId && department.company_id === nextCompanyId)) {
      setDepartmentId(null);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setFormError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImage(undefined);
      setFormError('Billedet skal være JPG, PNG eller WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImage(undefined);
      setFormError('Billedet må højst fylde 5 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const imageElement = new Image();
      imageElement.onload = () => resolve({ width: imageElement.naturalWidth, height: imageElement.naturalHeight });
      imageElement.onerror = () => resolve(null);
      imageElement.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    if (!dimensions || dimensions.width !== dimensions.height || dimensions.width < 800) {
      setImage(undefined);
      setFormError('Billedet skal være kvadratisk og mindst 800 × 800 px.');
      return;
    }
    setImage(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    const error = await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: userRole,
      companyId: selectedCompanyId,
      departmentId,
      status,
      image,
    }, user?.id);
    if (error) setFormError(error);
    setIsSaving(false);
  }

  const canChooseRole = actorRole === 'super_admin';
  const canChooseCompany = actorRole === 'super_admin';
  const showCompanyField = actorRole === 'super_admin';
  const canEditStatus = user?.status === 'active' || user?.status === 'inactive';
  const imagePreview = previewUrl || user?.avatar_url || '';
  const canUseImage = selectedCompanyId !== null && (!user || actorRole === 'super_admin' || user.role === 'employee');

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-user-modal-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-user-modal-title">{user ? 'Rediger bruger' : 'Opret bruger'}</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">×</button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {!user && canUseImage && (
            <div className="frigo-user-image-control">
              <span className="frigo-user-avatar frigo-user-avatar-large">
                {imagePreview
                  ? <img src={imagePreview} alt="" />
                  : <UserAvatar user={{ display_name: name, avatar_url: null }} />}
              </span>
              <div>
                <label className="frigo-user-upload-button">
                  Upload billede (valgfrit)
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageChange(event)} />
                </label>
                <p className="frigo-admin-modal-help">Kvadratisk, mindst 800 × 800 px. JPG, PNG eller WEBP, maks. 5 MB.</p>
              </div>
            </div>
          )}

          <div className="frigo-user-form-grid">
            <div>
              <label htmlFor="frigo-user-name">Navn</label>
              <input id="frigo-user-name" autoComplete="name" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
            </div>
            <div>
              <label htmlFor="frigo-user-email">E-mail</label>
              <input id="frigo-user-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
            </div>
            {showCompanyField && (
              <div>
                <label htmlFor="frigo-user-company">Virksomhed</label>
                {canChooseCompany ? (
                  <select
                    id="frigo-user-company"
                    value={selectedCompanyId ?? ''}
                    onChange={(event) => handleCompanyChange(event.currentTarget.value)}
                  >
                    {userRole === 'super_admin' && <option value="">Hele systemet</option>}
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                ) : null}
              </div>
            )}
            <div>
              <label htmlFor="frigo-user-department">Afdeling</label>
              <select
                id="frigo-user-department"
                value={departmentId ?? ''}
                onChange={(event) => setDepartmentId(event.currentTarget.value ? Number(event.currentTarget.value) : null)}
                disabled={selectedCompanyId === null}
              >
                <option value="">Hele virksomheden</option>
                {companyDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </div>
          </div>

          {canChooseRole && (
            <fieldset className="frigo-user-role-fieldset">
              <legend>Rolle</legend>
              {(['employee', 'company_admin', 'super_admin'] as UserRole[]).map((roleOption) => (
                <label className="frigo-user-radio" key={roleOption}>
                  <input
                    type="radio"
                    name="frigo-user-role"
                    value={roleOption}
                    checked={userRole === roleOption}
                    onChange={() => setUserRole(roleOption)}
                  />
                  <span>{roleLabel(roleOption)}</span>
                  {roleOption === 'employee' && <small>Bruger kun appen</small>}
                  {roleOption === 'company_admin' && <small>Adgang til adminpanelet</small>}
                </label>
              ))}
            </fieldset>
          )}

          {user && (
            <div>
              <label htmlFor="frigo-user-status">Status</label>
              <select
                id="frigo-user-status"
                value={status}
                onChange={(event) => setStatus(event.currentTarget.value as UserStatus)}
                disabled={!canEditStatus}
              >
                {canEditStatus ? (
                  <>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </>
                ) : <option value={status}>{statusLabel(status)}</option>}
              </select>
              {!canEditStatus && <p className="frigo-admin-modal-help">Afventende brugere håndteres under Anmodninger.</p>}
              {user.avatar_url && <p className="frigo-admin-modal-help">Profilbilledet kan ikke ændres her.</p>}
            </div>
          )}

          {!user && <p className="frigo-admin-modal-help">Brugeren bliver godkendt med det samme og får en e-mail med login.</p>}
          {formError && <p className="frigo-admin-error" role="alert">{formError}</p>}
          <div className="frigo-admin-modal-actions">
            <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>Annuller</button>
            <button className="frigo-admin-primary-button" type="submit" disabled={isSaving || !name.trim() || !email.trim() || (userRole !== 'super_admin' && selectedCompanyId === null)}>
              {isSaving ? 'Gemmer...' : user ? 'Gem ændringer' : 'Opret bruger'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteUserModal({
  user,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  user: ManagedUser;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="frigo-admin-modal-backdrop">
      <section className="frigo-admin-modal frigo-admin-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="frigo-delete-user-title">
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-delete-user-title">Slet bruger</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onCancel} disabled={isDeleting} aria-label="Luk">×</button>
        </div>
        <p className="frigo-admin-modal-help">
          {user.display_name} kan ikke længere logge ind. Regnskabsregistreringer bevares i fem år.
        </p>
        <div className="frigo-admin-modal-actions">
          <button className="frigo-admin-secondary-button" type="button" onClick={onCancel} disabled={isDeleting}>Annuller</button>
          <button className="frigo-admin-danger-button" type="button" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Sletter...' : 'Slet bruger'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function UserManagement({
  role,
  companyId,
}: {
  role: AdminRole;
  companyId: number | null;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setLoadError(sessionError.message);
      setIsLoading(false);
      return;
    }
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setLoadError('Log ind igen for at se brugere.');
      setIsLoading(false);
      return;
    }
    setCurrentUserId(userId);

    let profileQuery = supabase
      .from('profiles')
      .select('id, display_name, email, role, status, company_id, department_id, avatar_path')
      .neq('status', 'deleted')
      .order('display_name');
    if (role === 'company_admin') {
      if (companyId === null) {
        setLoadError('Din konto er ikke tilknyttet en virksomhed.');
        setIsLoading(false);
        return;
      }
      profileQuery = profileQuery.eq('company_id', companyId);
    }

    const [profilesResult, companiesResult, departmentsResult] = await Promise.all([
      profileQuery,
      role === 'super_admin'
        ? supabase.from('companies').select('id, name').eq('status', 'active').order('name')
        : supabase.from('companies').select('id, name').eq('id', companyId ?? -1).eq('status', 'active'),
      role === 'super_admin'
        ? supabase.from('departments').select('id, company_id, name').order('name')
        : supabase.from('departments').select('id, company_id, name').eq('company_id', companyId ?? -1).order('name'),
    ]);
    const firstError = profilesResult.error ?? companiesResult.error ?? departmentsResult.error;
    if (firstError) {
      setLoadError(firstError.message);
      setIsLoading(false);
      return;
    }

    const companyRows = companiesResult.data ?? [];
    const departmentRows = departmentsResult.data ?? [];
    const profileRows = profilesResult.data ?? [];
    const avatarPaths = profileRows.flatMap((profile) => profile.avatar_path ? [profile.avatar_path] : []);
    const { data: signedImages, error: imagesError } = avatarPaths.length
      ? await supabase.storage.from('profile-images').createSignedUrls(avatarPaths, 3600)
      : { data: [], error: null };
    if (imagesError) {
      setLoadError(`Profilbilleder kunne ikke indlæses: ${imagesError.message}`);
      setIsLoading(false);
      return;
    }
    const imageByPath = new Map((signedImages ?? []).map((image) => [image.path, image.signedUrl]));
    setCompanies(companyRows);
    setDepartments(departmentRows);
    setUsers(profileRows.map((profile) => ({
      ...profile,
      role: profile.role as UserRole,
      status: profile.status as UserStatus,
      avatar_url: profile.avatar_path ? imageByPath.get(profile.avatar_path) ?? null : null,
    })));
    setIsLoading(false);
  }, [companyId, role]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesSearch = !search || `${user.display_name} ${user.email}`.toLocaleLowerCase().includes(search);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? user.status === 'active' : user.status !== 'active');
      return matchesSearch && matchesStatus;
    });
  }, [query, statusFilter, users]);

  async function submitUser(input: UserInput, userId?: string): Promise<string | null> {
    setActionError('');
    setNotice('');
    let uploadedPath: string | null = null;
    const uploadCompanyId = role === 'company_admin' ? companyId : input.companyId;
    if (!userId && input.image && uploadCompanyId !== null) {
      const extension = input.image.type === 'image/jpeg' ? 'jpg' : input.image.type === 'image/png' ? 'png' : 'webp';
      uploadedPath = `${uploadCompanyId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('profile-images').upload(uploadedPath, input.image, {
        contentType: input.image.type,
        upsert: false,
      });
      if (uploadError) return `Billedet kunne ikke uploades: ${uploadError.message}`;
    }

    const body = userId
      ? {
          action: 'update',
          userId,
          name: input.name,
          email: input.email,
          role: input.role,
          companyId: input.companyId,
          departmentId: input.departmentId,
          status: input.status,
        }
      : {
          action: 'create',
          name: input.name,
          email: input.email,
          role: input.role,
          companyId: input.companyId,
          departmentId: input.departmentId,
          avatarPath: uploadedPath,
        };
    const { error } = await supabase.functions.invoke('manage-users', { body });
    if (error) {
      const message = await getFunctionError(error);
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('profile-images').remove([uploadedPath]);
        if (cleanupError) return `${message} Billedet kunne heller ikke ryddes op: ${cleanupError.message}`;
      }
      return message;
    }

    setShowCreateModal(false);
    setEditingUser(null);
    setNotice(userId
      ? 'Brugeren er opdateret.'
      : `Brugeren er oprettet, godkendt og inviteret til ${input.email}.`);
    await loadUsers();
    return null;
  }

  async function deleteUser() {
    if (!deletingUser) return;
    setIsDeleting(true);
    setActionError('');
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete', userId: deletingUser.id },
    });
    if (error) {
      setActionError(await getFunctionError(error));
    } else {
      setNotice(`${deletingUser.display_name} er slettet og kan ikke længere logge ind.`);
      setDeletingUser(null);
      await loadUsers();
    }
    setIsDeleting(false);
  }

  return (
    <>
      {notice && <p className="frigo-admin-notice" role="status">{notice}</p>}
      {actionError && <p className="frigo-admin-error" role="alert">{actionError}</p>}
      {loadError && <p className="frigo-admin-error" role="alert">Brugere kunne ikke indlæses: {loadError}</p>}

      <div className="frigo-admin-section-header frigo-user-section-header">
        <div>
          <p>Medarbejdere, virksomhedsadmins og superadmins på tværs af virksomheder..</p>
        </div>
        <button
          className="frigo-admin-primary-button"
          type="button"
          onClick={() => {
            setNotice('');
            setActionError('');
            setShowCreateModal(true);
          }}
        >
          <span aria-hidden="true">+</span>
          Opret bruger
        </button>
      </div>

      <section className="frigo-user-panel" aria-label="Brugerliste">
        <div className="frigo-user-toolbar">
          <label className="frigo-user-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Søg på navn eller e-mail"
              placeholder="Søg på navn eller e-mail"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <div className="frigo-user-filters" aria-label="Filtrer brugere">
            {([
              ['all', 'Alle'],
              ['active', 'Aktive'],
              ['inactive', 'Inaktive'],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                className={statusFilter === filter ? 'is-selected' : ''}
                aria-pressed={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="frigo-admin-company-message" role="status">Indlæser brugere...</div>
        ) : visibleUsers.length === 0 ? (
          <div className="frigo-admin-company-message" role="status">
            {users.length === 0 ? 'Der er ingen brugere at vise.' : 'Ingen brugere matcher søgningen.'}
          </div>
        ) : (
          <div className="frigo-user-table-wrap">
            <table className="frigo-user-table">
              <thead>
                <tr>
                  <th scope="col">Navn</th>
                  <th scope="col">Virksomhed · afdeling</th>
                  <th scope="col">Rolle</th>
                  <th scope="col">Status</th>
                  <th scope="col">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const canManage = user.id !== currentUserId && (role === 'super_admin' || user.role === 'employee');
                  const companyName = companies.find((company) => company.id === user.company_id)?.name ?? '';
                  const departmentName = user.department_id === null
                    ? 'Hele virksomheden'
                    : departments.find((department) => department.id === user.department_id)?.name ?? 'Hele virksomheden';
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="frigo-user-identity">
                          <span className="frigo-user-avatar"><UserAvatar user={user} /></span>
                          <span>
                            <strong>{user.display_name}</strong>
                            <small>{user.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="frigo-user-company">{role === 'super_admin' ? companyName || 'Alle virksomheder' : companies.find(({ id }) => id === companyId)?.name ?? 'Virksomhed'}</span>
                        <small className="frigo-user-department">{departmentName}</small>
                      </td>
                      <td><span className={`frigo-user-role-chip is-${user.role}`}>{roleLabel(user.role)}</span></td>
                      <td><span className={`frigo-user-status is-${user.status}`}>{statusLabel(user.status)}</span></td>
                      <td>
                        <div className="frigo-user-actions">
                          <button
                            className="frigo-user-icon-button"
                            type="button"
                            aria-label={`Rediger ${user.display_name}`}
                            title="Rediger"
                            disabled={!canManage}
                            onClick={() => {
                              setNotice('');
                              setActionError('');
                              setEditingUser(user);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>
                          </button>
                          <button
                            className="frigo-user-icon-button is-danger"
                            type="button"
                            aria-label={`Slet ${user.display_name}`}
                            title="Slet"
                            disabled={!canManage}
                            onClick={() => {
                              setNotice('');
                              setActionError('');
                              setDeletingUser(user);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(showCreateModal || editingUser) && (
        <UserModal
          key={editingUser?.id ?? 'new'}
          user={editingUser}
          companies={companies}
          departments={departments}
          role={role}
          companyId={companyId}
          onClose={() => {
            setShowCreateModal(false);
            setEditingUser(null);
          }}
          onSubmit={submitUser}
        />
      )}
      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          isDeleting={isDeleting}
          onCancel={() => setDeletingUser(null)}
          onConfirm={() => void deleteUser()}
        />
      )}
    </>
  );
}
