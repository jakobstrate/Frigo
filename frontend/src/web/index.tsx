import { Link } from 'expo-router';
import { useState } from 'react';

import { useLogin } from '@/frontend/src/hooks/use-login';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';

export default function WebLoginPage() {
  const { email, setEmail, password, setPassword, error, isLoading, handleLogin } = useLogin();
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);

  return (
    <main className="frigo-web frigo-login-page">
      <section className="frigo-login-brand-panel" aria-label="Frigo">
        <div className="frigo-login-brand-content">
          <Link href="/" className="frigo-login-brand">
            <FrigoLogo size={30} tone="light" />
          </Link>
          <h1>Styr køleskabet fra<br className="frigo-login-desktop-break" /> ét sted.</h1>
        </div>
      </section>

      <section className="frigo-login-form-panel" aria-labelledby="login-title">
        <div className="frigo-login-card">
          <h2 id="login-title">Log ind</h2>
          <p className="frigo-login-subtitle">Du sendes videre til din rolle.</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }} aria-busy={isLoading}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="navn@virksomhed.dk"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">Adgangskode</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              className="frigo-login-forgot"
              type="button"
              aria-expanded={showPasswordHelp}
              onClick={() => setShowPasswordHelp((shown) => !shown)}>
              Glemt adgangskode?
            </button>
            {showPasswordHelp && (
              <p className="frigo-login-help" role="status">
                Kontakt din virksomhedsadministrator for at nulstille adgangskoden.
              </p>
            )}
            {error && <p className="frigo-web-error" role="alert">{error}</p>}
            <button type="submit" disabled={isLoading || !email.trim() || !password}>
              {isLoading ? 'Logger ind...' : 'Log ind'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}