import { Link, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { supabase } from '@/backend/src/supabase';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';
import { AdminRole, getAdminPages, hasAdminPermission, type AdminPageId } from '@/frontend/src/web/admin-access';
import AdminReviewScreen from '@/frontend/src/shared/screens/admin-review';
import CompanyManagement from '@/frontend/src/web/company-management';

type AdminProfile = {
  id: string;
  display_name: string;
  email: string;
  role: AdminRole;
  company_id: number | null;
};

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      profile: AdminProfile;
      companyName: string;
      pendingRequests: number;
      notice: string;
    };

function isAdminRole(role: string): role is AdminRole {
  return role === 'super_admin' || role === 'company_admin';
}

function AdminIcon({ page }: { page: AdminPageId }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (page) {
    case 'overview':
      return <svg {...common}><path d="M4 19V10M10 19V5M16 19v-7M22 19V8" /></svg>;
    case 'companies':
      return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2m2 0h2M9 11h2m2 0h2M10 21v-5h4v5" /></svg>;
    case 'users':
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'requests':
      return <svg {...common}><path d="M4 5h16l1 5H3l1-5ZM4 10v9h16v-9M9 14h6" /></svg>;
    case 'departments':
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></svg>;
    case 'products':
      return <svg {...common}><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></svg>;
    case 'registrations':
      return <svg {...common}><path d="M6 3h12v18l-6-3-6 3V3Z" /><path d="M9 8h6M9 12h6" /></svg>;
  }
}

function AdminPageContent({
  page,
  profile,
  companyName,
  pendingRequests,
}: {
  page: AdminPageId;
  profile: AdminProfile;
  companyName: string;
  pendingRequests: number;
}) {
  const pageDetails = getAdminPages(profile.role).find((item) => item.id === page);
  if (!pageDetails) return null;

  if (page === 'requests') {
    return <AdminReviewScreen embedded />;
  }

  if (page === 'overview') {
    return (
      <>
        <div className="frigo-admin-summary-grid">
          <article className="frigo-admin-summary-card">
            <span className="frigo-admin-summary-label">Din adgang</span>
            <strong>{profile.role === 'super_admin' ? 'Superadmin' : 'Virksomhedsadmin'}</strong>
            <span>Aktiv administrator</span>
          </article>
          <article className="frigo-admin-summary-card">
            <span className="frigo-admin-summary-label">Virksomhed</span>
            <strong>{companyName || (profile.role === 'super_admin' ? 'Alle virksomheder' : 'Ikke tilknyttet')}</strong>
            <span>{profile.role === 'super_admin' ? 'Global adgang' : 'Din tilknytning'}</span>
          </article>
          <article className="frigo-admin-summary-card">
            <span className="frigo-admin-summary-label">Afventende anmodninger</span>
            <strong>{pendingRequests}</strong>
            <span>Adgangsanmodninger til gennemgang</span>
          </article>
        </div>
        <section className="frigo-admin-panel">
          <h2>Velkommen til Frigo</h2>
          <p>Brug menuen til venstre for at administrere de områder, du har adgang til.</p>
        </section>
      </>
    );
  }

  if (page === 'companies') {
    return <CompanyManagement />;
  }

  return (
    <section className="frigo-admin-panel">
      <div className="frigo-admin-panel-icon"><AdminIcon page={page} /></div>
      <h2>{pageDetails.label}</h2>
      <p>{pageDetails.description}</p>
      <div className="frigo-admin-empty-state">
        <strong>{pageDetails.label} vises her</strong>
        <span>Dette område er klar til at blive udbygget med administration af {pageDetails.label.toLowerCase()}.</span>
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { page: pageParam } = useLocalSearchParams<{ page?: string | string[] }>();
  const requestedPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const [dashboard, setDashboard] = useState<DashboardState>({ status: 'loading' });
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) {
        setDashboard({ status: 'error', message: sessionError.message });
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        router.replace('/' as Href);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, email, role, company_id, status')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;
      if (profileError) {
        setDashboard({ status: 'error', message: profileError.message });
        return;
      }
      if (!profile) {
        router.replace('/' as Href);
        return;
      }
      if (profile.status !== 'active') {
        router.replace(profile.status === 'pending' || profile.status === 'rejected' ? '/pending' as Href : '/' as Href);
        return;
      }
      if (!isAdminRole(profile.role)) {
        router.replace('/explore' as Href);
        return;
      }

      const currentProfile: AdminProfile = {
        id: profile.id,
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role,
        company_id: profile.company_id,
      };

      let companyName = '';
      if (currentProfile.company_id !== null) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('name')
          .eq('id', currentProfile.company_id)
          .maybeSingle();
        if (!isMounted) return;
        if (companyError) {
          setDashboard({ status: 'error', message: companyError.message });
          return;
        }
        companyName = company?.name ?? '';
      }

      const { count, error: requestsError } = await supabase
        .from('employee_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('requested_admin_id', currentProfile.id);

      if (!isMounted) return;
      setDashboard({
        status: 'ready',
        profile: currentProfile,
        companyName,
        pendingRequests: count ?? 0,
        notice: requestsError ? `Anmodninger kunne ikke indlæses: ${requestsError.message}` : '',
      });
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const allowedPages = dashboard.status === 'ready' ? getAdminPages(dashboard.profile.role) : [];
  const defaultPage = allowedPages[0]?.id;
  const activePage = allowedPages.find(({ id }) => id === requestedPage)?.id ?? defaultPage;

  useEffect(() => {
    if (dashboard.status !== 'ready' || !activePage || requestedPage === activePage) return;
    router.replace({ pathname: '/admin-review', params: { page: activePage } } as Href);
  }, [activePage, dashboard.status, requestedPage]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError('');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError(error.message);
      setIsSigningOut(false);
      return;
    }
    router.replace('/' as Href);
  }

  if (dashboard.status === 'loading') {
    return <div className="frigo-admin-loading" role="status">Indlæser Frigo...</div>;
  }
  if (dashboard.status === 'error') {
    return <div className="frigo-admin-load-error" role="alert">{dashboard.message}</div>;
  }

  const { profile, companyName, pendingRequests, notice } = dashboard;
  const roleLabel = profile.role === 'super_admin' ? 'Superadmin' : 'Virksomhedsadmin';
  const initials = profile.display_name.trim().slice(0, 2).toUpperCase() || 'FR';

  return (
    <div className="frigo-admin">
      <aside className="frigo-admin-sidebar">
        <div className="frigo-admin-brand">
          <FrigoLogo size={27} tone="light" />
          <span className="frigo-admin-role-chip">{roleLabel}</span>
        </div>
        <nav className="frigo-admin-navigation" aria-label="Hovedmenu">
          {allowedPages.map((item) => {
            const selected = item.id === activePage;
            return (
              <Link
                key={item.id}
                href={{ pathname: '/admin-review', params: { page: item.id } } as Href}
                className={`frigo-admin-nav-link${selected ? ' is-active' : ''}`}
                aria-current={selected ? 'page' : undefined}
              >
                <AdminIcon page={item.id} />
                <span>{item.label}</span>
                {item.id === 'requests' && pendingRequests > 0 && (
                  <span className="frigo-admin-nav-badge" aria-label={`${pendingRequests} afventende anmodninger`}>
                    {pendingRequests}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="frigo-admin-account">
          <span className="frigo-admin-avatar">{initials}</span>
          <span className="frigo-admin-account-details">
            <strong>{profile.display_name}</strong>
            <span>{companyName || roleLabel}</span>
          </span>
          <button
            className="frigo-admin-sign-out"
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            aria-label="Log ud"
            title="Log ud"
          >
            ↪
          </button>
        </div>
      </aside>
      <main className="frigo-admin-main">
        <header className="frigo-admin-page-header">
          <div>
            <p className="frigo-admin-eyebrow">FRIGO ADMINISTRATION</p>
            <h1>{allowedPages.find(({ id }) => id === activePage)?.label}</h1>
          </div>
        </header>
        {notice && <p className="frigo-admin-notice" role="status">{notice}</p>}
        {signOutError && <p className="frigo-admin-error" role="alert">Kunne ikke logge ud: {signOutError}</p>}
        {activePage && hasAdminPermission(profile.role, `page:${activePage}`) && (
          <AdminPageContent
            page={activePage}
            profile={profile}
            companyName={companyName}
            pendingRequests={pendingRequests}
          />
        )}
      </main>
    </div>
  );
}
