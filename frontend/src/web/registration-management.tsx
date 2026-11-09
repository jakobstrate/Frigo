import { useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/backend/src/supabase';
import type { AdminRole } from '@/frontend/src/web/admin-access';

type Company = { id: number; name: string };
type Department = { id: number; name: string };
type Purchase = {
  id: number;
  purchaser_id: string;
  purchaser_name: string;
  department_id: number;
  department_name: string;
  product_name: string;
  amount: number;
  total_price: number;
  created_at: string;
};
type Period = { id: string; start: Date; end: Date; endExclusive: Date; label: string };
type EmployeeSummary = {
  id: string;
  name: string;
  department: string;
  amount: number;
  total: number;
};
type RegistrationView = 'employee' | 'all';
type PeriodPreset = 'current' | 'week' | 'year' | 'custom';

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getCurrentPeriod(now = new Date()): Period {
  const start = now.getDate() >= 21
    ? new Date(now.getFullYear(), now.getMonth(), 21)
    : new Date(now.getFullYear(), now.getMonth() - 1, 21);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 20);
  return createPeriod(start, end);
}

function getMatchingPreset(period: Period): PeriodPreset {
  const now = new Date();
  const today = toDateInputValue(now);
  const start = toDateInputValue(period.start);
  const end = toDateInputValue(period.end);
  if (period.id === getCurrentPeriod(now).id) return 'current';
  if (
    start === toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
    && end === today
  ) return 'week';
  if (start === toDateInputValue(new Date(now.getFullYear(), 0, 1)) && end === today) return 'year';
  return 'custom';
}

function createPeriod(start: Date, end: Date): Period {
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const endExclusive = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), normalizedEnd.getDate() + 1);
  const id = `${toDateInputValue(normalizedStart)}-${toDateInputValue(normalizedEnd)}`;
  const label = `${formatDate(normalizedStart, true)} – ${formatDate(normalizedEnd, true)}`;
  return { id, start: normalizedStart, end: normalizedEnd, endExclusive, label };
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthDays(month: Date) {
  const firstDay = getMonthStart(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function formatDate(date: Date, includeYear = false) {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatFileDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: 2,
  }).format(amount);
}

function toCsvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function loadPurchases(companyId: number, period: Period) {
  const pageSize = 1000;
  const purchases: Purchase[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase
      .from('purchases')
      .select('id, purchaser_id, purchaser_name, department_id, department_name, product_name, amount, total_price, created_at')
      .eq('company_id', companyId)
      .gte('created_at', period.start.toISOString())
      .lt('created_at', period.endExclusive.toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };

    const page = result.data ?? [];
    purchases.push(...page);
    if (page.length < pageSize) return { data: purchases, error: null };
  }
}

export default function RegistrationManagement({
  role,
  companyId,
}: {
  role: AdminRole;
  companyId: number | null;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod);
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => toDateInputValue(selectedPeriod.start));
  const [draftEnd, setDraftEnd] = useState(() => toDateInputValue(selectedPeriod.end));
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()));
  const [draftPreset, setDraftPreset] = useState<PeriodPreset>('current');
  const periodPickerRef = useRef<HTMLDivElement>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    role === 'company_admin' ? companyId : null,
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<RegistrationView>('employee');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(role === 'super_admin');
  const [isLoading, setIsLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [dataError, setDataError] = useState('');

  const activeCompanyId = role === 'super_admin' ? selectedCompanyId : companyId;

  useEffect(() => {
    if (role !== 'super_admin') return;

    let isMounted = true;
    async function loadCompanies() {
      setIsLoadingCompanies(true);
      setCompanyError('');
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .neq('status', 'deleted')
        .order('name');

      if (!isMounted) return;
      if (error) {
        setCompanyError(error.message);
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
  }, [companyId, role]);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanyData() {
      if (activeCompanyId === null) {
        setDepartments([]);
        setPurchases([]);
        setDataError('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setDataError('');
      setPurchases([]);
      const [departmentsResult, purchasesResult] = await Promise.all([
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', activeCompanyId)
          .order('name'),
        loadPurchases(activeCompanyId, selectedPeriod),
      ]);

      if (!isMounted) return;
      const error = departmentsResult.error ?? purchasesResult.error;
      if (error) {
        setDataError(error.message);
        setDepartments([]);
        setPurchases([]);
      } else {
        setDepartments(departmentsResult.data ?? []);
        setPurchases(purchasesResult.data ?? []);
      }
      setIsLoading(false);
    }

    void loadCompanyData();
    return () => {
      isMounted = false;
    };
  }, [activeCompanyId, selectedPeriod]);

  const visiblePurchases = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('da-DK');
    return purchases.filter((purchase) => {
      const matchesDepartment = selectedDepartmentId === 'all'
        || String(purchase.department_id) === selectedDepartmentId;
      const matchesName = !normalizedSearch
        || purchase.purchaser_name.toLocaleLowerCase('da-DK').includes(normalizedSearch);
      return matchesDepartment && matchesName;
    });
  }, [purchases, search, selectedDepartmentId]);

  const employeeSummaries = useMemo(() => {
    const byEmployee = new Map<string, EmployeeSummary>();
    for (const purchase of visiblePurchases) {
      const summary = byEmployee.get(purchase.purchaser_id) ?? {
        id: purchase.purchaser_id,
        name: purchase.purchaser_name,
        department: purchase.department_name,
        amount: 0,
        total: 0,
      };
      summary.amount += purchase.amount;
      summary.total += Number(purchase.total_price);
      byEmployee.set(purchase.purchaser_id, summary);
    }
    return [...byEmployee.values()].sort((first, second) => first.name.localeCompare(second.name, 'da'));
  }, [visiblePurchases]);

  const totalSpending = visiblePurchases.reduce((total, purchase) => total + Number(purchase.total_price), 0);
  const totalGoods = visiblePurchases.reduce((total, purchase) => total + purchase.amount, 0);
  const registeredUsers = new Set(visiblePurchases.map((purchase) => purchase.purchaser_id)).size;

  function openPeriodPicker() {
    setDraftStart(toDateInputValue(selectedPeriod.start));
    setDraftEnd(toDateInputValue(selectedPeriod.end));
    setVisibleMonth(getMonthStart(selectedPeriod.start));
    setDraftPreset(getMatchingPreset(selectedPeriod));
    setIsPeriodPickerOpen(true);
  }

  function setDatePreset(preset: Exclude<PeriodPreset, 'custom'>) {
    const now = new Date();
    const start = preset === 'current'
      ? getCurrentPeriod(now).start
      : preset === 'week'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        : new Date(now.getFullYear(), 0, 1);
    setDraftStart(toDateInputValue(start));
    setDraftEnd(toDateInputValue(now));
    setVisibleMonth(getMonthStart(preset === 'current' ? start : now));
    setDraftPreset(preset);
  }

  function selectCalendarDate(date: Date) {
    const value = toDateInputValue(date);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(value);
      setDraftEnd('');
    } else if (value < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(value);
    } else {
      setDraftEnd(value);
    }
    setDraftPreset('custom');
  }

  function applyPeriod() {
    if (!draftStart || !draftEnd) return;
    const start = fromDateInputValue(draftStart);
    const end = fromDateInputValue(draftEnd);
    setSelectedPeriod(createPeriod(start <= end ? start : end, start <= end ? end : start));
    setIsPeriodPickerOpen(false);
  }

  function renderCalendarMonth(month: Date) {
    const weekdays = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];
    const todayValue = toDateInputValue(new Date());
    const days = getMonthDays(month);
    return (
      <div className="frigo-admin-period-calendar-month">
        <h3>{new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric' }).format(month)}</h3>
        <div className="frigo-admin-period-calendar-grid" role="grid">
          {weekdays.map((weekday) => (
            <span className="frigo-admin-period-weekday" key={weekday} role="columnheader">{weekday}</span>
          ))}
          {days.map((day) => {
            const value = toDateInputValue(day);
            const inMonth = day.getMonth() === month.getMonth();
            const inRange = Boolean(draftStart && draftEnd && value >= draftStart && value <= draftEnd);
            const isSelected = value === draftStart || value === draftEnd;
            return (
              <button
                key={value}
                type="button"
                role="gridcell"
                className={[
                  'frigo-admin-period-day',
                  !inMonth ? 'is-outside-month' : '',
                  inRange ? 'is-in-range' : '',
                  isSelected ? 'is-selected' : '',
                  value === todayValue ? 'is-today' : '',
                ].filter(Boolean).join(' ')}
                aria-label={formatDate(day, true)}
                aria-pressed={isSelected}
                onClick={() => selectCalendarDate(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isPeriodPickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !periodPickerRef.current?.contains(event.target)) {
        setIsPeriodPickerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPeriodPickerOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPeriodPickerOpen]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !exportMenuRef.current?.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsExportMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  function exportCsv(exportView: RegistrationView) {
    const headings = exportView === 'employee'
      ? ['Medarbejder', 'Afdeling', 'Antal varer', 'Beløb']
      : ['Dato', 'Medarbejder', 'Produkt', 'Antal', 'Beløb'];
    const rows = exportView === 'employee'
      ? employeeSummaries.map((employee) => [
        employee.name,
        employee.department,
        employee.amount,
        formatCurrency(employee.total),
      ])
      : visiblePurchases.map((purchase) => [
        formatDateTime(new Date(purchase.created_at)),
        purchase.purchaser_name,
        purchase.product_name,
        purchase.amount,
        formatCurrency(Number(purchase.total_price)),
      ]);
    const csv = [headings, ...rows].map((row) => row.map(toCsvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `registreringer-${formatFileDate(selectedPeriod.start)}-${formatFileDate(selectedPeriod.end)}-${exportView === 'employee' ? 'pr-medarbejder' : 'alle-registreringer'}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setIsExportMenuOpen(false);
  }

  return (
    <section className="frigo-admin-registrations" aria-label="Registreringer">
      <header className="frigo-admin-page-header">
        <div>
          <p className="frigo-admin-eyebrow">FRIGO ADMINISTRATION</p>
          <h1>Registreringer</h1>
        </div>
        <div className="frigo-admin-registration-toolbar">
          <div className="frigo-admin-registration-export-wrapper" ref={exportMenuRef}>
            <button
              className="frigo-admin-registration-export"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
              disabled={isLoading || activeCompanyId === null}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
              Eksportér CSV
              <svg className="frigo-admin-registration-export-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {isExportMenuOpen && (
              <div className="frigo-admin-registration-export-menu" role="menu" aria-label="Vælg CSV-format">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => exportCsv('employee')}
                >
                  <span className="frigo-admin-registration-export-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v5h5m-9 4h5m-5 4h5" /></svg>
                  </span>
                  <span><strong>Pr. medarbejder</strong><small>Én linje pr. medarbejder med totaler</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => exportCsv('all')}
                >
                  <span className="frigo-admin-registration-export-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v5h5m-9 4h5m-5 4h5" /></svg>
                  </span>
                  <span><strong>Alle registreringer</strong><small>Én linje pr. vare med dato og tid</small></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={`frigo-admin-registration-filters${role === 'company_admin' ? ' is-company-admin' : ''}`}>
        <div className="frigo-admin-period-picker" ref={periodPickerRef}>
          <span className="frigo-admin-registration-filter-label">Periode</span>
          <button
            className="frigo-admin-period-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isPeriodPickerOpen}
            onClick={() => isPeriodPickerOpen ? setIsPeriodPickerOpen(false) : openPeriodPicker()}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" /></svg>
            <span>{selectedPeriod.label}</span>
            <svg className="frigo-admin-period-trigger-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
          </button>
          {isPeriodPickerOpen && (
            <div className="frigo-admin-period-popover" role="dialog" aria-label="Vælg periode">
              <div className="frigo-admin-period-presets" aria-label="Hurtige perioder">
                <button
                  type="button"
                  className={draftPreset === 'current' ? 'is-selected' : ''}
                  onClick={() => setDatePreset('current')}
                >
                  Standard 21.–20.
                </button>
                <button
                  type="button"
                  className={draftPreset === 'week' ? 'is-selected' : ''}
                  onClick={() => setDatePreset('week')}
                >
                  Sidste 7 dage
                </button>
                <button
                  type="button"
                  className={draftPreset === 'year' ? 'is-selected' : ''}
                  onClick={() => setDatePreset('year')}
                >
                  I år
                </button>
              </div>
              <div className="frigo-admin-period-inputs">
                <label>
                  Fra
                  <input
                    type="date"
                    value={draftStart}
                    onChange={(event) => {
                      setDraftStart(event.target.value);
                      setDraftPreset('custom');
                      if (event.target.value) setVisibleMonth(getMonthStart(fromDateInputValue(event.target.value)));
                    }}
                  />
                </label>
                <label>
                  Til
                  <input
                    type="date"
                    value={draftEnd}
                    onChange={(event) => {
                      setDraftEnd(event.target.value);
                      setDraftPreset('custom');
                      if (event.target.value) setVisibleMonth(getMonthStart(fromDateInputValue(event.target.value)));
                    }}
                  />
                </label>
              </div>
              <div className="frigo-admin-period-calendar-navigation">
                <button
                  type="button"
                  aria-label="Forrige måned"
                  onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                >
                  ‹
                </button>
                <span>Vælg slutdato</span>
                <button
                  type="button"
                  aria-label="Næste måned"
                  onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  ›
                </button>
              </div>
              <div className="frigo-admin-period-calendars">
                {renderCalendarMonth(visibleMonth)}
                {renderCalendarMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
              </div>
              <div className="frigo-admin-period-actions">
                <button type="button" className="frigo-admin-period-cancel" onClick={() => setIsPeriodPickerOpen(false)}>
                  Annuller
                </button>
                <button
                  type="button"
                  className="frigo-admin-period-apply"
                  disabled={!draftStart || !draftEnd}
                  onClick={applyPeriod}
                >
                  Vis periode
                </button>
              </div>
            </div>
          )}
        </div>
        {role === 'super_admin' && (
          <label>
            Virksomhed
            <select
              value={selectedCompanyId ?? ''}
              onChange={(event) => {
                setSelectedCompanyId(event.target.value ? Number(event.target.value) : null);
                setSelectedDepartmentId('all');
              }}
              disabled={isLoadingCompanies}
              aria-label="Vælg virksomhed"
            >
              <option value="">{isLoadingCompanies ? 'Indlæser...' : 'Vælg virksomhed'}</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Afdeling
          <select
            value={selectedDepartmentId}
            onChange={(event) => setSelectedDepartmentId(event.target.value)}
            disabled={activeCompanyId === null || isLoading}
            aria-label="Vælg afdeling"
          >
            <option value="all">Alle afdelinger</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label className="frigo-admin-registration-search">
          Medarbejder
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søg på navn"
            aria-label="Søg efter medarbejder"
          />
        </label>
        <div className="frigo-admin-registration-view-toggle" role="group" aria-label="Vis registreringer">
          <button
            type="button"
            className={view === 'employee' ? 'is-selected' : ''}
            aria-pressed={view === 'employee'}
            onClick={() => setView('employee')}
          >
            Pr. medarbejder
          </button>
          <button
            type="button"
            className={view === 'all' ? 'is-selected' : ''}
            aria-pressed={view === 'all'}
            onClick={() => setView('all')}
          >
            Alle registreringer
          </button>
        </div>
      </div>

      {companyError && <p className="frigo-admin-error" role="alert">Virksomhederne kunne ikke indlæses: {companyError}</p>}
      {dataError && <p className="frigo-admin-error" role="alert">Registreringerne kunne ikke indlæses: {dataError}</p>}

      <div className="frigo-admin-registration-summary" aria-live="polite">
        <article>
          <span>Forbrug i perioden</span>
          <strong>{formatCurrency(totalSpending)}</strong>
        </article>
        <article>
          <span>Varer</span>
          <strong>{totalGoods}</strong>
        </article>
        <article>
          <span>Medarbejdere med registreringer</span>
          <strong>{registeredUsers}</strong>
        </article>
      </div>

      <div className="frigo-admin-registration-table-panel">
        {isLoading ? (
          <p className="frigo-admin-overview-empty" role="status">Indlæser registreringer...</p>
        ) : visiblePurchases.length === 0 ? (
          <p className="frigo-admin-overview-empty">Ingen registreringer matcher dine filtre.</p>
        ) : view === 'employee' ? (
          <div className="frigo-admin-registration-table-scroll">
            <table className="frigo-admin-registration-table">
              <thead>
                <tr><th>Medarbejder</th><th>Afdeling</th><th className="is-numeric">Antal varer</th><th className="is-numeric">Beløb</th></tr>
              </thead>
              <tbody>
                {employeeSummaries.map((employee) => (
                  <tr key={employee.id}>
                    <th scope="row">{employee.name}</th>
                    <td>{employee.department}</td>
                    <td className="is-numeric">{employee.amount}</td>
                    <td className="is-numeric">{formatCurrency(employee.total)}</td>
                  </tr>
                ))}
                <tr className="frigo-admin-registration-total">
                  <th scope="row" colSpan={2}>I alt</th>
                  <td className="is-numeric">{totalGoods}</td>
                  <td className="is-numeric">{formatCurrency(totalSpending)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="frigo-admin-registration-table-scroll">
            <table className="frigo-admin-registration-table">
              <thead>
                <tr><th>Dato</th><th>Medarbejder</th><th>Produkt</th><th className="is-numeric">Antal</th><th className="is-numeric">Beløb</th></tr>
              </thead>
              <tbody>
                {visiblePurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{formatDate(new Date(purchase.created_at))}</td>
                    <th scope="row">{purchase.purchaser_name}</th>
                    <td>{purchase.product_name}</td>
                    <td className="is-numeric">{purchase.amount}</td>
                    <td className="is-numeric">{formatCurrency(Number(purchase.total_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
