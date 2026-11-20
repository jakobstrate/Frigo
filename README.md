# Frigo

Frigo has an Expo mobile app and a website in the same repository. They share dependencies and backend code, but can have different screens, styles, and navigation.

## Run web and mobile separately

Install dependencies with `npm install`, then run either command, or both in separate terminals:

```bash
npm run start:app
npm run start:web
```

The mobile development server uses port 8081. Scan its QR code with a compatible Expo Go client or press `i` / `a` for a simulator. `npm run ios` and `npm run android` also start the mobile server.

The website runs at http://localhost:8082. `npm run web` is an alias for `npm run start:web`. Stopping one server does not stop the other.

## Creating companies

Companies can be created without a company administrator, or with an optional administrator invitation by providing both the administrator name and email. Apply `supabase/schema.sql`, `supabase/add_product_unit.sql`, `supabase/auth_flow.sql`, `supabase/share_product_catalog.sql`, `supabase/update_company_details.sql`, `supabase/manage_department_products.sql`, and `supabase/data_retention.sql` to the Supabase project in that order. Then deploy the Edge Functions:

```bash
supabase functions deploy create-company
supabase functions deploy update-company
supabase functions deploy manage-users
```

For an existing project, apply the updated `supabase/auth_flow.sql`, `supabase/data_retention.sql`, and `supabase/update_company_details.sql` to add multi-role assignments, account-deletion request support, keep invited accounts inactive and uncounted until a password is created, allow purchases for employees assigned to "Hele virksomheden", reject purchases of products deactivated while a cart is open, allow department product selections to change without being blocked by purchase history, support permanent deletion of soft-deleted users while retaining anonymized accounting history, and enable Realtime updates for the employee catalog, then redeploy `manage-users` and `update-company`.

Users can have multiple roles, selected independently in the user editor. Company administrators are also assigned the employee role by default so they can use the app; Superadmins can be assigned company admin and employee roles for a selected company and department. Without the employee role and a company assignment, an account remains admin-only. On mobile, company-linked admins with the employee role are sent to the app, while web sign-in continues to open the admin dashboard.

The employee app refreshes products and categories when relevant database changes arrive, when it returns to the foreground, and every 5 seconds while open. Changes to an employee's department also refresh their profile and product access. Realtime publication setup is included in `schema.sql` and `auth_flow.sql`; apply the updated SQL to your Supabase project for immediate change notifications. The periodic refresh also handles changes hidden by employee row-level security.

Superadmins can deactivate or reactivate a company from its status badge. Deactivation blocks login for every company user while retaining their profiles and company data; the `manage-users` Edge Function must be deployed for this action.

When a company has no active administrator, the edit dialog can send an invitation to create its first one.

The edit modal updates the company name, departments, and selected active company administrator. Removing a department can fail if its categories are still referenced by products; move those products first. Changing the administrator email updates the Auth login immediately and confirms the new email as a Superadmin action.

The user page is available to Superadmins across all companies and to company administrators within their own company. Superadmins can assign multiple roles and a company membership; company administrators can create and manage employee-only accounts. Admin-created accounts stay inactive and are not included in company user counts until the invitee creates a password. Employee registration lists active companies, and the approving administrator assigns the department. A user without a department belongs to the whole company. Profile pictures must be square, at least 800 × 800 pixels, JPG/PNG/WEBP, and no larger than 5 MB.

New employee requests appear in the web administration request page for the selected company's active administrators. Companies without an active company administrator route requests to an active Superadmin. Employees can request account deletion from app settings; an administrator can reject the request or approve it to block sign-in and soft-delete the profile.

Deleting a profile or company blocks account sign-in and soft-deletes the profile/company without immediately removing accounting history. Superadmins can permanently delete soft-deleted users from the deleted-users list. This removes the login, profile, and linked payment-provider account, while retaining purchase/payment history with the purchaser identity removed for the existing five-year retention period. The database also prevents deletion of a company's last active administrator. `data_retention.sql` schedules a daily Supabase Cron job that removes expired accounting rows, Auth users, profiles, and companies after the retention period.

The department page lets Superadmins select a company and manage its departments, while company admins are restricted to their own company. Department product selections are saved through `set_department_products` so the product list is replaced atomically.

For an existing Supabase project, apply `supabase/manage_department_products.sql` to add the department product-selection function.

For an existing Supabase project, apply `supabase/add_product_unit.sql` before using product management to add the product unit field.

`supabase/share_product_catalog.sql` makes product and category data shared across companies. Existing products are preserved as separate catalog entries; the migration does not merge products with matching names. Categories with the same name are consolidated. Department-level product availability remains company-specific.

The function uses Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets, which are available to deployed functions by default. Invitation links open the app's `/invite` page, where the administrator sets a password. Add the hosted app's `/invite` URL (and any local development invite URL) to Supabase Auth's allowed redirect URLs. Set the `INVITE_REDIRECT_URL` function secret if the invite should always return to a specific app URL.

## Separate platform screens

The frontend is organized by platform:

```text
frontend/src/
	routes/          Expo Router entry files (thin re-exports)
	web/             Website pages, layout, and styles.css
	app/             Mobile screens and navigation layout
	shared/screens/  Screens currently used by both platforms
	components/      Shared and platform-specific components
	hooks/           Shared hooks, including use-login.ts
	constants/       Shared theme constants
```

Edit `frontend/src/web/index.tsx` for the browser sign-in page and `frontend/src/app/index.tsx` for mobile sign-in. Each platform also has its own `layout.tsx`. The web sign-in page has no create-account link; mobile keeps it.

Signup, pending, explore, and admin review route directly to `shared/screens`, without intermediate files in `app` or `web`. Changes in `shared/screens` affect both platforms.

Use `frontend/src/components/frigo-logo.tsx` for the Frigo mark and wordmark anywhere new branding is needed. It renders the shared vector icon on web and native.

Create platform-specific files only when a screen actually differs. For example, to give admin review a different web UI, add `web/admin-review.tsx` with that implementation and `routes/admin-review.web.tsx` re-exporting it. The existing `routes/admin-review.tsx` continues to use the shared screen on mobile. For a mobile-only UI, add `app/admin-review.tsx` and point the regular route entry to it, keeping a web route entry pointing to the shared or web implementation.

The web admin dashboard uses `web/admin-access.ts` for role-based page and modal permissions. Add page permissions there to expose new dashboard sections; modal permissions use the `modal:<name>` format with `hasAdminPermission`.

The `routes` directory contains only route wiring and is configured as the Expo Router root in `app.json`. Expo Router selects `.web.tsx` route entries for web and the regular `.tsx` entries for mobile. Keep a regular route file alongside every `.web.tsx` route. Shared backend code remains in `backend/src`.

This is one Expo project with independent development servers and platform UIs, not two separately managed dependency projects. Both platforms still use the same Supabase project and public environment variables. Browser sessions and native sessions are stored separately.

## Checks and builds

```bash
npm run typecheck
npm run build:web
```

The website build is exported to `dist` for static hosting. Native production builds use the existing Expo configuration with EAS Build or `npx expo run:ios` / `npx expo run:android`.
