import { Link } from 'expo-router';

import { useLogin } from '@/frontend/src/hooks/use-login';

export default function WebLoginPage() {
  const { email, setEmail, password, setPassword, error, isLoading, handleLogin } = useLogin();

  return (
    <div className="frigo-web">
      <header className="frigo-web-header">
        <Link href="/" className="frigo-web-brand">Frigo</Link>
      </header>
      <main className="frigo-web-main">
        <section className="frigo-web-login" aria-labelledby="login-title">
          <p className="frigo-web-eyebrow">WELCOME BACK</p>
          <h1 id="login-title">Sign in to your account</h1>
          <p className="frigo-web-subtitle">Your company shop, all in one place.</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }} aria-busy={isLoading}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <p className="frigo-web-error" role="alert">{error}</p>}
            <button type="submit" disabled={isLoading || !email.trim() || !password}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="frigo-web-footer">By continuing, you agree to your company&apos;s Frigo access policies.</p>
        </section>
      </main>
    </div>
  );
}