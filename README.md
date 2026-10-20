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

Company creation and company-admin invitations are handled by the Supabase Edge Function `create-company`. Apply `supabase/schema.sql` and then `supabase/auth_flow.sql` to the Supabase project, and deploy the function with the Supabase CLI:

```bash
supabase functions deploy create-company
```

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
