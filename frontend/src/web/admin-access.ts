export type AdminRole = 'super_admin' | 'company_admin';

export const ADMIN_PAGES = [
  { id: 'overview', label: 'Overblik', description: 'Et samlet overblik over Frigo.' },
  { id: 'companies', label: 'Virksomheder', description: 'Administrer virksomheder i Frigo.' },
  { id: 'users', label: 'Brugere', description: 'Se og administrer brugere.' },
  { id: 'requests', label: 'Anmodninger', description: 'Gennemgå adgangsanmodninger.' },
  { id: 'departments', label: 'Afdelinger', description: 'Administrer virksomhedens afdelinger.' },
  { id: 'products', label: 'Produkter', description: 'Administrer produktkataloget.' },
  { id: 'registrations', label: 'Registreringer', description: 'Se virksomhedens registreringer.' },
] as const;

export type AdminPageId = (typeof ADMIN_PAGES)[number]['id'];
export type AdminPermission = `page:${AdminPageId}` | `modal:${string}`;
type PermissionGrant = AdminPermission | '*';

const ROLE_PERMISSIONS: Record<AdminRole, readonly PermissionGrant[]> = {
  super_admin: ['*'],
  company_admin: [
    'page:users',
    'page:requests',
    'page:departments',
    'page:products',
    'page:registrations',
  ],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  return grants.includes('*') || grants.includes(permission);
}

export function getAdminPages(role: AdminRole) {
  return ADMIN_PAGES.filter(({ id }) => hasAdminPermission(role, `page:${id}`));
}
