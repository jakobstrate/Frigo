import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';
import type { AdminRole } from '@/frontend/src/web/admin-access';

type Company = { id: number; name: string };
type Department = { id: number; name: string; inherits_catalog: boolean };
type Product = { id: number; name: string; category_id: number | null };
type Category = { id: number; name: string; department_id: number | null };
type DepartmentProduct = { department_id: number; product_id: number };

function DepartmentNameModal({
  department,
  isSaving,
  onClose,
  onSave,
}: {
  department: Department;
  isSaving: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(department?.name ?? '');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setError('');
    try {
      await onSave(trimmedName);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Afdelingen kunne ikke gemmes.');
    }
  }

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-department-name-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-department-name-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-department-name-title">Rediger afdeling</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">
            ×
          </button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="frigo-department-name">Afdelingsnavn</label>
          <input
            id="frigo-department-name"
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Fx Marketing"
          />
          {error && <p className="frigo-admin-error" role="alert">{error}</p>}
          <div className="frigo-admin-modal-actions">
            <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>
              Annuller
            </button>
            <button className="frigo-admin-primary-button" type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Gemmer...' : 'Gem ændringer'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteDepartmentModal({
  department,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: {
  department: Department;
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
        aria-labelledby="frigo-delete-department-title"
        aria-describedby="frigo-delete-department-description"
        aria-busy={isDeleting}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-delete-department-title">Slet afdeling?</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isDeleting} aria-label="Luk">
            ×
          </button>
        </div>
        <p id="frigo-delete-department-description" className="frigo-admin-modal-help">
          <strong>{department.name}</strong> og dens produktvalg slettes. Historiske køb kan forhindre sletning.
        </p>
        {error && <p className="frigo-admin-error" role="alert">{error}</p>}
        <div className="frigo-admin-modal-actions">
          <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isDeleting}>
            Annuller
          </button>
          <button className="frigo-admin-danger-button" type="button" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Sletter...' : 'Slet afdeling'}
          </button>
        </div>
      </section>
    </div>
  );
}

function DepartmentProductsModal({
  department,
  products,
  categories,
  selectedProductIds,
  isSaving,
  onClose,
  onSave,
}: {
  department: Department;
  products: Product[];
  categories: Category[];
  selectedProductIds: number[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (productIds: number[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(selectedProductIds));
  const [error, setError] = useState('');
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const selectableProducts = products.filter((product) => {
    if (product.category_id === null) return true;
    const category = categoryById.get(product.category_id);
    return !category || category.department_id === null || category.department_id === department.id;
  });

  function toggleProduct(productId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function handleSave() {
    setError('');
    try {
      await onSave([...selectedIds]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Produktvalget kunne ikke gemmes.');
    }
  }

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-department-products-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-department-products-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-department-products-title">Produkter for {department.name}</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">
            ×
          </button>
        </div>
        <p className="frigo-department-products-help">Medarbejdere i afdelingen kan kun registrere de valgte produkter.</p>
        {selectableProducts.length > 0 ? (
          <div className="frigo-department-product-list">
            {selectableProducts.map((product) => {
              const category = product.category_id === null ? null : categoryById.get(product.category_id);
              return (
                <label className="frigo-department-product-option" key={product.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    disabled={isSaving}
                  />
                  <span>{product.name}</span>
                  <span className="frigo-department-product-category">{category?.name ?? 'Uden kategori'}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="frigo-admin-company-message">Der er ingen aktive produkter, som kan vælges til afdelingen.</div>
        )}
        {error && <p className="frigo-admin-error" role="alert">{error}</p>}
        <div className="frigo-department-products-footer">
          <span>{selectedIds.size} af {selectableProducts.length} valgt</span>
          <div className="frigo-admin-modal-actions">
            <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>
              Annuller
            </button>
            <button className="frigo-admin-primary-button" type="button" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Gemmer...' : 'Gem'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DepartmentManagement({
  role,
  companyId,
  companyName,
}: {
  role: AdminRole;
  companyId: number | null;
  companyName: string;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(role === 'company_admin' ? companyId : null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departmentProducts, setDepartmentProducts] = useState<DepartmentProduct[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(role === 'super_admin');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [departmentModal, setDepartmentModal] = useState<{ department: Department } | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentForProducts, setDepartmentForProducts] = useState<Department | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<number | null>(null);

  useEffect(() => {
    if (role !== 'super_admin') return;
    let isMounted = true;

    async function loadCompanies() {
      setIsLoadingCompanies(true);
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .neq('status', 'deleted')
        .order('name');

      if (!isMounted) return;
      if (error) {
        setLoadError(error.message);
        setCompanies([]);
      } else {
        const availableCompanies = data ?? [];
        setCompanies(availableCompanies);
        setSelectedCompanyId((currentId) =>
          availableCompanies.some((company) => company.id === currentId)
            ? currentId
            : availableCompanies[0]?.id ?? null,
        );
      }
      setIsLoadingCompanies(false);
    }

    void loadCompanies();
    return () => {
      isMounted = false;
    };
  }, [role]);

  useEffect(() => {
    if (role === 'company_admin') {
      setSelectedCompanyId(companyId);
    }
  }, [companyId, role]);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanyDepartments() {
      if (selectedCompanyId === null) {
        setDepartments([]);
        setProducts([]);
        setCategories([]);
        setDepartmentProducts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');
      const [departmentsResult, productsResult, categoriesResult, membershipsResult] = await Promise.all([
        supabase
          .from('departments')
          .select('id, name, inherits_catalog')
          .eq('company_id', selectedCompanyId)
          .order('name'),
        supabase
          .from('products')
          .select('id, name, category_id')
          .eq('company_id', selectedCompanyId)
          .eq('active', true)
          .order('name'),
        supabase
          .from('categories')
          .select('id, name, department_id')
          .eq('company_id', selectedCompanyId)
          .order('name'),
        supabase
          .from('department_products')
          .select('department_id, product_id')
          .eq('company_id', selectedCompanyId),
      ]);

      if (!isMounted) return;
      const queryError = departmentsResult.error ?? productsResult.error ?? categoriesResult.error ?? membershipsResult.error;
      if (queryError) {
        setLoadError(queryError.message);
        setDepartments([]);
        setProducts([]);
        setCategories([]);
        setDepartmentProducts([]);
      } else {
        setDepartments(departmentsResult.data ?? []);
        setProducts(productsResult.data ?? []);
        setCategories(categoriesResult.data ?? []);
        setDepartmentProducts(membershipsResult.data ?? []);
      }
      setIsLoading(false);
    }

    void loadCompanyDepartments();
    return () => {
      isMounted = false;
    };
  }, [reloadKey, role, selectedCompanyId]);

  const companyLabel = role === 'company_admin'
    ? companyName
    : companies.find((company) => company.id === selectedCompanyId)?.name ?? '';
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const productIdsByDepartment = useMemo(() => {
    const memberships = new Map<number, number[]>();
    const activeProductIds = new Set(products.map((product) => product.id));
    for (const membership of departmentProducts) {
      if (!activeProductIds.has(membership.product_id)) continue;
      const productIds = memberships.get(membership.department_id) ?? [];
      productIds.push(membership.product_id);
      memberships.set(membership.department_id, productIds);
    }
    return memberships;
  }, [departmentProducts, products]);
  const selectableProductCountByDepartment = useMemo(() => {
    const counts = new Map<number, number>();
    for (const department of departments) {
      const count = products.filter((product) => {
        if (product.category_id === null) return true;
        const category = categoryById.get(product.category_id);
        return !category || category.department_id === null || category.department_id === department.id;
      }).length;
      counts.set(department.id, count);
    }
    return counts;
  }, [categories, categoryById, departments, products]);

  async function saveDepartmentName(name: string) {
    if (selectedCompanyId === null) throw new Error('Vælg en virksomhed først.');
    setIsSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { department } = departmentModal ?? {};
      if (!department) throw new Error('Vælg en afdeling, der skal redigeres.');
      const result = await supabase
        .from('departments')
        .update({ name })
        .eq('id', department.id)
        .eq('company_id', selectedCompanyId)
        .select('id')
        .maybeSingle();

      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error('Afdelingen blev ikke fundet for den valgte virksomhed.');
      setDepartmentModal(null);
      setSuccessMessage(`${name} er opdateret.`);
      setReloadKey((key) => key + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDepartmentNameSave(name: string) {
    try {
      await saveDepartmentName(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Afdelingen kunne ikke gemmes.';
      setActionError(message);
      throw error;
    }
  }

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newDepartmentName.trim();
    if (!name || selectedCompanyId === null) return;

    setIsSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase
        .from('departments')
        .insert({ company_id: selectedCompanyId, name });
      if (error) throw new Error(error.message);
      setNewDepartmentName('');
      setSuccessMessage(`${name} er oprettet.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(`Afdelingen kunne ikke oprettes: ${error instanceof Error ? error.message : 'Ukendt fejl.'}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    setDeletingDepartmentId(department.id);
    setActionError('');
    setSuccessMessage('');
    try {
      const { data, error } = await supabase
        .from('departments')
        .delete()
        .eq('id', department.id)
        .eq('company_id', selectedCompanyId ?? -1)
        .select('id')
        .maybeSingle();

      if (error) {
        setActionError(`Afdelingen kunne ikke slettes: ${error.message}`);
      } else if (!data) {
        setActionError('Afdelingen blev ikke fundet for den valgte virksomhed.');
      } else {
        setDepartmentToDelete(null);
        setSuccessMessage(`${department.name} er slettet.`);
        setReloadKey((key) => key + 1);
      }
    } catch (error) {
      setActionError(`Afdelingen kunne ikke slettes: ${error instanceof Error ? error.message : 'Ukendt fejl.'}`);
    } finally {
      setDeletingDepartmentId(null);
    }
  }

  async function changeCatalogMode(department: Department, inheritsCatalog: boolean) {
    if (selectedCompanyId === null) return;
    setIsSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { data, error } = await supabase
        .from('departments')
        .update({ inherits_catalog: inheritsCatalog })
        .eq('id', department.id)
        .eq('company_id', selectedCompanyId)
        .select('id')
        .maybeSingle();

      if (error) {
        setActionError(`Produktindstillingen kunne ikke ændres: ${error.message}`);
      } else if (!data) {
        setActionError('Afdelingen blev ikke fundet for den valgte virksomhed.');
      } else {
        setSuccessMessage(inheritsCatalog
          ? `${department.name} har nu alle aktive produkter.`
          : `${department.name} bruger nu et udvalg af produkter.`);
        setReloadKey((key) => key + 1);
      }
    } catch (error) {
      setActionError(`Produktindstillingen kunne ikke ændres: ${error instanceof Error ? error.message : 'Ukendt fejl.'}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProductSelection(department: Department, productIds: number[]) {
    setIsSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('set_department_products', {
        p_department_id: department.id,
        p_product_ids: productIds,
      });
      if (error) throw new Error(error.message);
      setDepartmentForProducts(null);
      setSuccessMessage(`Produktudvalget for ${department.name} er gemt.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Produktudvalget kunne ikke gemmes.';
      setActionError(message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <p className="frigo-department-description">Vælg hvilke produkter medarbejderne i hver afdeling kan registrere.</p>
      <section className="frigo-department-company-selector" aria-label="Virksomhed">
        <label htmlFor="frigo-department-company">Virksomhed</label>
        {role === 'super_admin' ? (
          <select
            id="frigo-department-company"
            value={selectedCompanyId ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSelectedCompanyId(value ? Number(value) : null);
              setDepartmentModal(null);
              setDepartmentToDelete(null);
              setDepartmentForProducts(null);
              setNewDepartmentName('');
              setActionError('');
              setSuccessMessage('');
            }}
            disabled={isLoadingCompanies || companies.length === 0 || isSaving}
          >
            {companies.length === 0 && <option value="">Ingen virksomheder</option>}
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        ) : (
          <span className="frigo-department-company-locked">{companyLabel || 'Din virksomhed'}</span>
        )}
      </section>

      {loadError && <p className="frigo-admin-error" role="alert">Afdelinger kunne ikke indlæses: {loadError}</p>}
      {actionError && !departmentModal && !departmentForProducts && !departmentToDelete && (
        <p className="frigo-admin-error" role="alert">{actionError}</p>
      )}
      {successMessage && <p className="frigo-admin-notice" role="status">{successMessage}</p>}

      <form className="frigo-department-create" onSubmit={(event) => void createDepartment(event)} aria-busy={isSaving}>
        <label htmlFor="frigo-new-department-name">Opret afdeling</label>
        <div className="frigo-department-create-fields">
          <input
            id="frigo-new-department-name"
            maxLength={80}
            placeholder="Fx Marketing"
            value={newDepartmentName}
            onChange={(event) => setNewDepartmentName(event.currentTarget.value)}
            disabled={selectedCompanyId === null || isLoading || isSaving}
          />
          <button
            className="frigo-admin-primary-button"
            type="submit"
            disabled={selectedCompanyId === null || isLoading || isSaving || !newDepartmentName.trim()}
          >
            <span aria-hidden="true">+</span>
            {isSaving ? 'Opretter...' : 'Opret'}
          </button>
        </div>
      </form>

      {isLoadingCompanies ? (
        <div className="frigo-admin-company-message" role="status">Indlæser virksomheder...</div>
      ) : selectedCompanyId === null ? (
        <div className="frigo-admin-company-message">Der er ingen virksomheder at administrere.</div>
      ) : isLoading ? (
        <div className="frigo-admin-company-message" role="status">Indlæser afdelinger...</div>
      ) : departments.length > 0 ? (
        <>
        <div className="frigo-admin-section-header frigo-department-section-header">
          <h2>{companyLabel ? `Afdelinger · ${companyLabel}` : 'Afdelinger'}</h2>
        </div>
        <div className="frigo-department-list">
          {departments.map((department) => {
            const availableProductCount = selectableProductCountByDepartment.get(department.id) ?? 0;
            const selectedProductIds = productIdsByDepartment.get(department.id) ?? [];
            const productCount = department.inherits_catalog ? availableProductCount : selectedProductIds.length;
            return (
              <article className="frigo-department-card" key={department.id}>
                <div className="frigo-department-card-details">
                  <h3>{department.name}</h3>
                  <p>
                    {department.inherits_catalog
                      ? `Alle ${productCount} produkter`
                      : `${productCount} af ${availableProductCount} produkter`}
                  </p>
                </div>
                <div className="frigo-department-controls">
                  <div className="frigo-department-mode" role="group" aria-label={`Produktadgang for ${department.name}`}>
                    <button
                      type="button"
                      className={department.inherits_catalog ? 'is-selected' : ''}
                      aria-pressed={department.inherits_catalog}
                      disabled={isSaving}
                      onClick={() => {
                        if (!department.inherits_catalog) void changeCatalogMode(department, true);
                      }}
                    >
                      Alle produkter
                    </button>
                    <button
                      type="button"
                      className={!department.inherits_catalog ? 'is-selected' : ''}
                      aria-pressed={!department.inherits_catalog}
                      disabled={isSaving}
                      onClick={() => {
                        if (department.inherits_catalog) void changeCatalogMode(department, false);
                      }}
                    >
                      Udvalgte produkter
                    </button>
                  </div>
                  {!department.inherits_catalog && (
                    <button
                      className="frigo-department-select-products"
                      type="button"
                      onClick={() => {
                        setActionError('');
                        setSuccessMessage('');
                        setDepartmentForProducts(department);
                      }}
                      disabled={isSaving}
                    >
                      Vælg produkter ({selectedProductIds.length})
                    </button>
                  )}
                  <button
                    className="frigo-department-icon-button"
                    type="button"
                    onClick={() => {
                      setActionError('');
                      setSuccessMessage('');
                      setDepartmentModal({ department });
                    }}
                    aria-label={`Rediger ${department.name}`}
                    title={`Rediger ${department.name}`}
                    disabled={isSaving}
                  >
                    <span aria-hidden="true">✎</span>
                  </button>
                  <button
                    className="frigo-department-icon-button is-danger"
                    type="button"
                    onClick={() => {
                      setActionError('');
                      setSuccessMessage('');
                      setDepartmentToDelete(department);
                    }}
                    aria-label={`Slet ${department.name}`}
                    title={`Slet ${department.name}`}
                    disabled={isSaving}
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
            );
          })}
        </div>
        </>
      ) : !loadError ? (
        <div className="frigo-admin-company-message">Der er endnu ikke oprettet nogen afdelinger.</div>
      ) : null}

      {departmentModal && (
        <DepartmentNameModal
          department={departmentModal.department}
          isSaving={isSaving}
          onClose={() => setDepartmentModal(null)}
          onSave={handleDepartmentNameSave}
        />
      )}
      {departmentToDelete && (
        <DeleteDepartmentModal
          department={departmentToDelete}
          isDeleting={deletingDepartmentId === departmentToDelete.id}
          error={actionError}
          onClose={() => setDepartmentToDelete(null)}
          onConfirm={() => void deleteDepartment(departmentToDelete)}
        />
      )}
      {departmentForProducts && (
        <DepartmentProductsModal
          department={departmentForProducts}
          products={products}
          categories={categories}
          selectedProductIds={productIdsByDepartment.get(departmentForProducts.id) ?? []}
          isSaving={isSaving}
          onClose={() => setDepartmentForProducts(null)}
          onSave={(productIds) => saveProductSelection(departmentForProducts, productIds)}
        />
      )}
    </>
  );
}
