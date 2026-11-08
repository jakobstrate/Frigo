import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';

type Category = { id: number; name: string; department_id: number | null };
type Product = {
  id: number;
  company_id: number | null;
  category_id: number | null;
  name: string;
  description: string | null;
  unit: string;
  price: number;
  image_path: string;
  active: boolean;
  image_url: string | null;
};

function ProductIcon({ kind }: { kind: 'edit' | 'delete' | 'plus' | 'image' }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  if (kind === 'edit') return <svg {...common}><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>;
  if (kind === 'delete') return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>;
  if (kind === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
}

function ProductModal({
  product,
  categories,
  isSaving,
  onClose,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    unit: string;
    price: number;
    categoryId: number | null;
    active: boolean;
    image: File | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [unit, setUnit] = useState(product?.unit ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [categoryId, setCategoryId] = useState(product?.category_id ? String(product.category_id) : '');
  const [active, setActive] = useState(product?.active ?? true);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) return;
    if (!product && !image) {
      setError('Upload et produktbillede.');
      return;
    }
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        unit: unit.trim(),
        price: parsedPrice,
        categoryId: categoryId ? Number(categoryId) : null,
        active,
        image,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Produktet kunne ikke gemmes.');
    }
  }

  return (
    <div className="frigo-admin-modal-backdrop">
      <section
        className="frigo-admin-modal frigo-product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frigo-product-modal-title"
        aria-busy={isSaving}
      >
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-product-modal-title">{product ? 'Rediger produkt' : 'Opret produkt'}</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">×</button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="frigo-product-form-top">
            <div className="frigo-product-image-editor">
              <div className="frigo-product-image-preview">
                {(imagePreview ?? product?.image_url) ? (
                  <img src={imagePreview ?? product?.image_url ?? ''} alt="" />
                ) : (
                  <ProductIcon kind="image" />
                )}
              </div>
              <label className="frigo-product-upload">
                <ProductIcon kind="image" />
                {image ? 'Skift billede' : product ? 'Skift billede' : 'Upload billede'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSaving}
                  onChange={(event) => {
                    const selected = event.currentTarget.files?.[0] ?? null;
                    if (selected && selected.size > 5 * 1024 * 1024) {
                      setError('Billedet må højst være 5 MB.');
                      event.currentTarget.value = '';
                      return;
                    }
                    setError('');
                    setImage(selected);
                  }}
                />
              </label>
              {!product && <span className="frigo-product-required">Påkrævet</span>}
            </div>
            <div className="frigo-product-name-description">
              <label htmlFor="frigo-product-name">Navn</label>
              <input
                id="frigo-product-name"
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Fx Kildevand"
              />
              <label htmlFor="frigo-product-description">Beskrivelse</label>
              <textarea
                id="frigo-product-description"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="frigo-product-form-grid">
            <div>
              <label htmlFor="frigo-product-price">Pris (kr)</label>
              <input
                id="frigo-product-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(event) => setPrice(event.currentTarget.value)}
              />
            </div>
            <div>
              <label htmlFor="frigo-product-unit">Enhed</label>
              <input
                id="frigo-product-unit"
                maxLength={40}
                value={unit}
                onChange={(event) => setUnit(event.currentTarget.value)}
                placeholder="Fx 33 cl eller 50g"
              />
            </div>
            <div>
              <label htmlFor="frigo-product-category">Kategori</label>
              <select id="frigo-product-category" value={categoryId} onChange={(event) => setCategoryId(event.currentTarget.value)}>
                <option value="">Uden kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
                {product?.category_id !== null && product?.category_id !== undefined
                  && !categories.some((category) => category.id === product.category_id) && (
                    <option value={product.category_id}>Nuværende kategori</option>
                  )}
              </select>
            </div>
            <label className="frigo-product-active-toggle">
              <span>
                <strong>Aktiv i appen</strong>
                <small>Vises for medarbejderne</small>
              </span>
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.currentTarget.checked)} />
            </label>
          </div>
          {error && <p className="frigo-admin-error" role="alert">{error}</p>}
          <div className="frigo-admin-modal-actions">
            <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>Annuller</button>
            <button className="frigo-admin-primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Gemmer...' : product ? 'Gem ændringer' : 'Opret produkt'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CategoryModal({
  categories,
  productCounts,
  isSaving,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  productCounts: Map<number, number>;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (category: Category, name: string) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ category: Category; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState('');

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      await onCreate(name);
      setNewName('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kategorien kunne ikke oprettes.');
    }
  }

  async function saveCategory() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setError('');
    try {
      await onUpdate(editing.category, name);
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kategorien kunne ikke gemmes.');
    }
  }

  async function deleteCategory() {
    if (!deleting) return;
    setError('');
    try {
      await onDelete(deleting);
      setDeleting(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Kategorien kunne ikke slettes.');
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="frigo-admin-modal-backdrop">
        <section
          className="frigo-admin-modal frigo-category-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="frigo-category-modal-title"
          aria-busy={isSaving}
        >
          <div className="frigo-admin-modal-header">
            <h2 id="frigo-category-modal-title">Kategorier</h2>
            <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Luk">×</button>
          </div>
          <form className="frigo-category-create" onSubmit={(event) => void createCategory(event)}>
            <label htmlFor="frigo-new-category">Ny kategori</label>
            <div>
              <input
                id="frigo-new-category"
                required
                maxLength={80}
                value={newName}
                onChange={(event) => setNewName(event.currentTarget.value)}
              />
              <button className="frigo-admin-primary-button" type="submit" disabled={isSaving || !newName.trim()}>Opret</button>
            </div>
          </form>
          <div className="frigo-category-list">
            {categories.map((category) => (
              <div className="frigo-category-row" key={category.id}>
                {editing?.category.id === category.id ? (
                  <input
                    aria-label={`Rediger ${category.name}`}
                    autoFocus
                    maxLength={80}
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.currentTarget.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveCategory();
                      }
                    }}
                  />
                ) : (
                  <span className="frigo-category-row-details">
                    <strong>{category.name}</strong>
                    <small>{productCounts.get(category.id) ?? 0} produkter</small>
                  </span>
                )}
                <span className="frigo-category-row-actions">
                  {editing?.category.id === category.id ? (
                    <>
                      <button className="frigo-product-icon-button" type="button" onClick={() => void saveCategory()} disabled={isSaving} aria-label="Gem kategori">✓</button>
                      <button className="frigo-product-icon-button" type="button" onClick={() => setEditing(null)} disabled={isSaving} aria-label="Annuller">×</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="frigo-product-icon-button"
                        type="button"
                        onClick={() => setEditing({ category, name: category.name })}
                        disabled={isSaving}
                        aria-label={`Rediger ${category.name}`}
                      ><ProductIcon kind="edit" /></button>
                      <button
                        className="frigo-product-icon-button is-danger"
                        type="button"
                        onClick={() => setDeleting(category)}
                        disabled={isSaving}
                        aria-label={`Slet ${category.name}`}
                      ><ProductIcon kind="delete" /></button>
                    </>
                  )}
                </span>
              </div>
            ))}
            {categories.length === 0 && <p className="frigo-admin-company-message">Der er endnu ingen kategorier.</p>}
          </div>
          {error && <p className="frigo-admin-error" role="alert">{error}</p>}
          <p className="frigo-admin-modal-help">
            Kategorier bruges som filtre i appen. Når en kategori slettes, flyttes dens produkter til Uden kategori.
          </p>
        </section>
      </div>
      {deleting && (
        <div className="frigo-admin-modal-backdrop frigo-product-confirm-backdrop">
          <section className="frigo-admin-modal frigo-admin-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="frigo-category-delete-title">
            <div className="frigo-admin-modal-header">
              <h2 id="frigo-category-delete-title">Slet kategori?</h2>
            </div>
            <p className="frigo-admin-modal-help"><strong>{deleting.name}</strong> slettes, og tilknyttede produkter flyttes til Uden kategori.</p>
            <div className="frigo-admin-modal-actions">
              <button className="frigo-admin-secondary-button" type="button" onClick={() => setDeleting(null)} disabled={isSaving}>Annuller</button>
              <button className="frigo-admin-danger-button" type="button" onClick={() => void deleteCategory()} disabled={isSaving}>
                {isSaving ? 'Sletter...' : 'Slet kategori'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function DeleteProductModal({
  product,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: {
  product: Product;
  isDeleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="frigo-admin-modal-backdrop">
      <section className="frigo-admin-modal frigo-admin-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="frigo-product-delete-title" aria-busy={isDeleting}>
        <div className="frigo-admin-modal-header">
          <h2 id="frigo-product-delete-title">Slet produkt?</h2>
          <button className="frigo-admin-modal-close" type="button" onClick={onClose} disabled={isDeleting} aria-label="Luk">×</button>
        </div>
        <p className="frigo-admin-modal-help"><strong>{product.name}</strong> slettes fra virksomhedens produktkatalog. Historiske registreringer bevares.</p>
        {error && <p className="frigo-admin-error" role="alert">{error}</p>}
        <div className="frigo-admin-modal-actions">
          <button className="frigo-admin-secondary-button" type="button" onClick={onClose} disabled={isDeleting}>Annuller</button>
          <button className="frigo-admin-danger-button" type="button" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Sletter...' : 'Slet produkt'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<number | 'uncategorized' | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, company_id, category_id, name, description, unit, price, image_path, active')
        .is('company_id', null)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name, department_id')
        .is('company_id', null)
        .is('department_id', null)
        .order('name'),
    ]);

    const queryError = productsResult.error ?? categoriesResult.error;
    if (queryError) {
      setLoadError(`Produktkataloget kunne ikke indlæses: ${queryError.message}`);
      setProducts([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    const productRows = productsResult.data ?? [];
    const paths = productRows.map((product) => product.image_path);
    const { data: signedImages, error: imageError } = paths.length
      ? await supabase.storage.from('product-images').createSignedUrls(paths, 3600)
      : { data: [], error: null };
    if (imageError) {
      setLoadError(`Produktbilleder kunne ikke indlæses: ${imageError.message}`);
      setProducts([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    const imageByPath = new Map((signedImages ?? []).map((image) => [image.path, image.signedUrl]));
    setProducts(productRows.map((product) => ({
      ...product,
      price: Number(product.price),
      image_url: imageByPath.get(product.image_path) ?? null,
    })));
    setCategories(categoriesResult.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, reloadKey]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.department_id === null),
    [categories],
  );
  const filterCategories = categories;
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const editingCategories = useMemo(() => {
    if (!editingProduct || editingProduct.category_id === null
      || visibleCategories.some((category) => category.id === editingProduct.category_id)) {
      return visibleCategories;
    }
    const currentCategory = categoryById.get(editingProduct.category_id);
    return currentCategory ? [...visibleCategories, currentCategory] : visibleCategories;
  }, [categoryById, editingProduct, visibleCategories]);
  const productCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products) {
      if (product.category_id !== null) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
    return counts;
  }, [products]);
  const uncategorizedCount = useMemo(
    () => products.filter((product) => product.category_id === null || !categoryById.has(product.category_id)).length,
    [categoryById, products],
  );
  const filteredProducts = useMemo(
    () => categoryFilter === null
      ? products
      : products.filter((product) => categoryFilter === 'uncategorized'
        ? product.category_id === null || !categoryById.has(product.category_id)
        : product.category_id === categoryFilter),
    [categoryById, categoryFilter, products],
  );

  async function saveProduct(input: {
    name: string;
    description: string;
    unit: string;
    price: number;
    categoryId: number | null;
    active: boolean;
    image: File | null;
  }) {
    setIsSaving(true);
    setActionError('');
    let uploadedPath: string | null = null;
    const previousProduct = editingProduct ?? null;
    try {
      if (input.image) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.image.type)) {
          throw new Error('Vælg et JPG-, PNG- eller WEBP-billede.');
        }
        if (input.image.size > 5 * 1024 * 1024) throw new Error('Billedet må højst være 5 MB.');
        const extension = input.image.type === 'image/jpeg' ? 'jpg' : input.image.type === 'image/png' ? 'png' : 'webp';
        const path = `catalog/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, input.image, {
          contentType: input.image.type,
          upsert: false,
        });
        if (uploadError) throw new Error(`Billedet kunne ikke uploades: ${uploadError.message}`);
        uploadedPath = path;
      }

      const productValues = {
        company_id: null,
        category_id: input.categoryId,
        name: input.name,
        description: input.description || null,
        unit: input.unit,
        price: input.price,
        active: input.active,
      };
      if (!previousProduct && !uploadedPath) throw new Error('Upload et produktbillede.');
      const result = previousProduct
        ? await supabase
            .from('products')
            .update({ ...productValues, ...(uploadedPath ? { image_path: uploadedPath } : {}) })
            .eq('id', previousProduct.id)
        : await supabase
            .from('products')
            .insert({ ...productValues, image_path: uploadedPath });

      if (result.error) throw new Error(`Produktet kunne ikke gemmes: ${result.error.message}`);
      if (uploadedPath && previousProduct) {
        const { error: removeError } = await supabase.storage.from('product-images').remove([previousProduct.image_path]);
        if (removeError) setActionError(`Produktet blev gemt, men det gamle billede kunne ikke fjernes: ${removeError.message}`);
      }
      setEditingProduct(undefined);
      setReloadKey((key) => key + 1);
    } catch (saveError) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('product-images').remove([uploadedPath]);
        if (cleanupError) {
          throw new Error(`${saveError instanceof Error ? saveError.message : 'Produktet kunne ikke gemmes.'} Billedet kunne heller ikke ryddes op: ${cleanupError.message}`);
        }
      }
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function createCategory(name: string) {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('categories').insert({ company_id: null, name });
      if (error) throw new Error(`Kategorien kunne ikke oprettes: ${error.message}`);
      setReloadKey((key) => key + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCategory(category: Category, name: string) {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', category.id)
        .is('company_id', null);
      if (error) throw new Error(`Kategorien kunne ikke gemmes: ${error.message}`);
      setReloadKey((key) => key + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    setIsSaving(true);
    try {
      const { data: assignedProducts, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', category.id);
      if (productsError) throw new Error(`Kategoriens produkter kunne ikke indlæses: ${productsError.message}`);
      const productIds = (assignedProducts ?? []).map((product) => product.id);
      const { error: moveError } = await supabase
        .from('products')
        .update({ category_id: null })
        .eq('category_id', category.id);
      if (moveError) throw new Error(`Kategoriens produkter kunne ikke flyttes: ${moveError.message}`);

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .is('company_id', null);
      if (deleteError) {
        const { error: restoreError } = await supabase
          .from('products')
          .update({ category_id: category.id })
          .in('id', productIds);
        throw new Error(
          `Kategorien kunne ikke slettes: ${deleteError.message}${restoreError ? ` Produkternes kategori kunne heller ikke gendannes: ${restoreError.message}` : ''}`,
        );
      }
      setCategoryFilter((currentFilter) => currentFilter === category.id ? null : currentFilter);
      setReloadKey((key) => key + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProduct() {
    if (!deletingProduct) return;
    setIsDeleting(true);
    setDeleteError('');
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deletingProduct.id);
    if (error) {
      setDeleteError(`Produktet kunne ikke slettes: ${error.message}`);
      setIsDeleting(false);
      return;
    }

    const { error: imageError } = await supabase.storage.from('product-images').remove([deletingProduct.image_path]);
    if (imageError) setActionError(`Produktet blev slettet, men billedet kunne ikke fjernes: ${imageError.message}`);
    setDeletingProduct(null);
    setIsDeleting(false);
    setReloadKey((key) => key + 1);
  }

  return (
    <section className="frigo-products-page">
      <header className="frigo-products-heading">
        <div>
          <h1>Produkter</h1>
          <p>Produkter og kategorier, som medarbejderne kan registrere i appen.</p>
        </div>
          <button
            className="frigo-admin-primary-button frigo-products-create-button"
            type="button"
            onClick={() => setEditingProduct(null)}
          >
            <ProductIcon kind="plus" /> Opret produkt
          </button>
        </header>
        {actionError && <p className="frigo-admin-notice" role="status">{actionError}</p>}
        {loadError && <p className="frigo-admin-error" role="alert">{loadError}</p>}
        {isLoading ? (
          <div className="frigo-admin-company-message" role="status">Indlæser produktkatalog...</div>
        ) : (
        <div className="frigo-products-layout">
          <aside className="frigo-products-categories">
            <h2>Kategorier</h2>
            <button
              className={`frigo-product-category-filter${categoryFilter === null ? ' is-selected' : ''}`}
              type="button"
              onClick={() => setCategoryFilter(null)}
              aria-pressed={categoryFilter === null}
            >
              <span>Alle</span><small>{products.length}</small>
            </button>
            {filterCategories.map((category) => (
              <button
                className={`frigo-product-category-filter${categoryFilter === category.id ? ' is-selected' : ''}`}
                type="button"
                key={category.id}
                onClick={() => setCategoryFilter(category.id)}
                aria-pressed={categoryFilter === category.id}
              >
                <span>{category.name}</span><small>{productCounts.get(category.id) ?? 0}</small>
              </button>
            ))}
            <button
              className={`frigo-product-category-filter${categoryFilter === 'uncategorized' ? ' is-selected' : ''}`}
              type="button"
              onClick={() => setCategoryFilter('uncategorized')}
              aria-pressed={categoryFilter === 'uncategorized'}
            >
              <span>Uden kategori</span><small>{uncategorizedCount}</small>
            </button>
            <button className="frigo-products-edit-categories" type="button" onClick={() => setShowCategories(true)}>
              <ProductIcon kind="edit" /> Rediger kategorier
            </button>
          </aside>
          <div className="frigo-products-table-panel">
            <div className="frigo-products-table-scroll">
              <table className="frigo-products-table">
                <thead>
                  <tr><th>Produkt</th><th>Kategori</th><th>Pris</th><th>Status</th><th>Handlinger</th></tr>
                </thead>
                {products.length > 0 && (
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="frigo-product-cell">
                            <span className="frigo-product-thumb">
                              {product.image_url ? <img src={product.image_url} alt="" /> : <ProductIcon kind="image" />}
                            </span>
                            <span className="frigo-product-name">
                              <strong>{product.name}</strong>
                              <small>{product.unit || ''}</small>
                            </span>
                          </div>
                        </td>
                        <td>{product.category_id === null ? 'Uden kategori' : categoryById.get(product.category_id)?.name ?? 'Uden kategori'}</td>
                        <td className="frigo-product-price">{product.price.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr</td>
                        <td><span className={`frigo-admin-status${product.active ? '' : ' is-inactive'}`}>{product.active ? 'Aktiv' : 'Inaktiv'}</span></td>
                        <td>
                          <span className="frigo-product-actions">
                            <button className="frigo-product-icon-button" type="button" onClick={() => setEditingProduct(product)} aria-label={`Rediger ${product.name}`}>
                              <ProductIcon kind="edit" />
                            </button>
                            <button className="frigo-product-icon-button is-danger" type="button" onClick={() => { setDeleteError(''); setDeletingProduct(product); }} aria-label={`Slet ${product.name}`}>
                              <ProductIcon kind="delete" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr><td className="frigo-products-empty" colSpan={5}>Ingen produkter i denne kategori.</td></tr>
                    )}
                  </tbody>
                )}
              </table>
            </div>
            {products.length === 0 && (
              <div className="frigo-products-empty-state">
                <strong>Ingen produkter endnu</strong>
                <p>Opret det første produkt, så medarbejderne kan begynde at registrere.</p>
                <button className="frigo-admin-primary-button" type="button" onClick={() => setEditingProduct(null)}>
                  Opret produkt
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {editingProduct !== undefined && (
        <ProductModal
          product={editingProduct}
          categories={editingCategories}
          isSaving={isSaving}
          onClose={() => setEditingProduct(undefined)}
          onSave={saveProduct}
        />
      )}
      {showCategories && (
        <CategoryModal
          categories={visibleCategories}
          productCounts={productCounts}
          isSaving={isSaving}
          onClose={() => setShowCategories(false)}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
        />
      )}
      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          isDeleting={isDeleting}
          error={deleteError}
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => void deleteProduct()}
        />
      )}
    </section>
  );
}
